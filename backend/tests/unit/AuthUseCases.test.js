/**
 * Pruebas unitarias de AuthUseCases.
 * Se sustituyen los métodos estáticos del modelo User y se usan bcrypt y
 * jsonwebtoken reales para validar el comportamiento del caso de uso.
 */

import AuthUseCases from '../../src/core/application/usecases/AuthUseCases.js';
import { jest } from '@jest/globals';
import { User, config } from '../../src/barrel.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_ISSUER = 'the-brothers-barbershop-api';
const JWT_AUDIENCE = 'the-brothers-barbershop-users';

const buildUser = (overrides = {}) => ({
  _id: 'user123',
  name: 'Usuario de Prueba',
  email: 'usuario@example.com',
  password: 'hash',
  role: 'user',
  isActive: true,
  tokenVersion: 0,
  failedLoginAttempts: 0,
  lockUntil: null,
  isLocked() {
    return false;
  },
  save: jest.fn().mockResolvedValue(true),
  toObject() {
    const copy = { ...this };
    delete copy.isLocked;
    delete copy.save;
    delete copy.toObject;
    return copy;
  },
  ...overrides
});

const findOneResult = (value) => ({
  select: jest.fn().mockResolvedValue(value)
});

const findByIdResult = (value) => ({
  select: jest.fn().mockResolvedValue(value)
});

describe('AuthUseCases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('registra un usuario con rol user y devuelve token', async () => {
      const userData = {
        name: 'Juan Pérez',
        email: 'juan@example.com',
        password: 'Password123!',
        phone: '3001234567'
      };

      User.findOne = jest.fn().mockResolvedValue(null);
      User.create = jest.fn().mockImplementation(async (data) => buildUser({
        _id: 'nuevo123',
        ...data
      }));

      const result = await AuthUseCases.register(userData);

      expect(User.findOne).toHaveBeenCalledWith({
        email: userData.email,
        isActive: true
      });
      expect(User.create).toHaveBeenCalledTimes(1);
      const createdData = User.create.mock.calls[0][0];
      expect(createdData.role).toBe('user');
      expect(createdData.password).not.toBe(userData.password);
      expect(result).toHaveProperty('token');
      expect(result.user).toHaveProperty('email', userData.email);
      expect(result.user).not.toHaveProperty('password');
    });

    it('rechaza un email ya registrado', async () => {
      User.findOne = jest.fn().mockResolvedValue({ email: 'existente@example.com' });

      await expect(AuthUseCases.register({
        name: 'Otro',
        email: 'existente@example.com',
        password: 'Password123!'
      })).rejects.toThrow('El email ya está registrado');
    });
  });

  describe('login', () => {
    it('inicia sesión con credenciales correctas', async () => {
      const passwordHash = await bcrypt.hash('Password123!', 4);
      const user = buildUser({ password: passwordHash });

      User.findOne = jest.fn().mockReturnValue(findOneResult(user));

      const result = await AuthUseCases.login('usuario@example.com', 'Password123!');

      expect(result).toHaveProperty('token');
      expect(result.user).toHaveProperty('email', 'usuario@example.com');
      expect(result.user).not.toHaveProperty('password');

      const payload = jwt.verify(result.token, config.jwt.secret, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      });
      expect(payload).toMatchObject({ id: user._id, role: 'user' });
    });

    it('rechaza contraseña incorrecta e incrementa intentos fallidos', async () => {
      const passwordHash = await bcrypt.hash('Password123!', 4);
      const user = buildUser({ password: passwordHash });

      User.findOne = jest.fn().mockReturnValue(findOneResult(user));

      await expect(AuthUseCases.login('usuario@example.com', 'Incorrecta'))
        .rejects.toThrow('Credenciales inválidas');

      expect(user.failedLoginAttempts).toBe(1);
      expect(user.save).toHaveBeenCalled();
    });

    it('bloquea la cuenta al quinto intento fallido', async () => {
      const passwordHash = await bcrypt.hash('Password123!', 4);
      const user = buildUser({ password: passwordHash, failedLoginAttempts: 4 });

      User.findOne = jest.fn().mockReturnValue(findOneResult(user));

      await expect(AuthUseCases.login('usuario@example.com', 'Incorrecta'))
        .rejects.toThrow('Credenciales inválidas');

      expect(user.lockUntil).toBeInstanceOf(Date);
      expect(user.failedLoginAttempts).toBe(0);
    });

    it('rechaza cuentas desactivadas', async () => {
      const user = buildUser({ isActive: false });
      User.findOne = jest.fn().mockReturnValue(findOneResult(user));

      await expect(AuthUseCases.login('usuario@example.com', 'Password123!'))
        .rejects.toThrow('Cuenta desactivada. Contacta al administrador.');
    });

    it('rechaza cuentas bloqueadas temporalmente', async () => {
      const user = buildUser({
        isLocked: () => true,
        lockUntil: Date.now() + 5 * 60 * 1000
      });
      User.findOne = jest.fn().mockReturnValue(findOneResult(user));

      await expect(AuthUseCases.login('usuario@example.com', 'Password123!'))
        .rejects.toThrow(/Cuenta bloqueada temporalmente/);
    });

    it('rechaza un usuario inexistente sin filtrar información', async () => {
      User.findOne = jest.fn().mockReturnValue(findOneResult(null));

      await expect(AuthUseCases.login('nadie@example.com', 'Password123!'))
        .rejects.toThrow('Credenciales inválidas');
    });
  });

  describe('generateToken', () => {
    it('firma un token con el rol, tokenVersion y expiración del rol', () => {
      const user = buildUser({ role: 'user', tokenVersion: 3 });

      const token = AuthUseCases.generateToken(user);
      const payload = jwt.verify(token, config.jwt.secret, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      });

      expect(payload.id).toBe(user._id);
      expect(payload.role).toBe('user');
      expect(payload.tokenVersion).toBe(3);
      expect(payload.exp - payload.iat).toBe(6 * 60 * 60);
      expect(typeof payload.jti).toBe('string');
    });
  });

  describe('sanitizeUser', () => {
    it('elimina los campos sensibles del usuario', () => {
      const user = buildUser({
        resetPasswordToken: 'token',
        resetPasswordExpires: Date.now(),
        failedLoginAttempts: 2,
        lockUntil: new Date()
      });

      const sanitized = AuthUseCases.sanitizeUser(user);

      expect(sanitized).not.toHaveProperty('password');
      expect(sanitized).not.toHaveProperty('resetPasswordToken');
      expect(sanitized).not.toHaveProperty('resetPasswordExpires');
      expect(sanitized).not.toHaveProperty('tokenVersion');
      expect(sanitized).not.toHaveProperty('failedLoginAttempts');
      expect(sanitized).not.toHaveProperty('lockUntil');
      expect(sanitized).toHaveProperty('email', user.email);
    });
  });

  describe('refreshToken', () => {
    it('emite un token nuevo con un refresh token válido', async () => {
      const user = buildUser();
      const refreshToken = jwt.sign(
        { id: user._id, role: user.role, tokenVersion: user.tokenVersion },
        config.jwt.secret,
        { expiresIn: '1h', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );

      User.findById = jest.fn().mockResolvedValue(user);

      const result = await AuthUseCases.refreshToken(refreshToken);

      expect(result).toHaveProperty('token');
      expect(result.user).toHaveProperty('_id', user._id);

      const payload = jwt.verify(result.token, config.jwt.secret, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      });
      expect(payload.id).toBe(user._id);
    });

    it('rechaza un token inválido', async () => {
      await expect(AuthUseCases.refreshToken('token.invalido'))
        .rejects.toThrow('Token inválido');
    });

    it('acepta un token expirado dentro de los 7 días de sesión', async () => {
      const user = buildUser();
      const expiredToken = jwt.sign(
        { id: user._id, role: user.role, tokenVersion: user.tokenVersion },
        config.jwt.secret,
        { expiresIn: -10, issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );

      User.findById = jest.fn().mockResolvedValue(user);

      const result = await AuthUseCases.refreshToken(expiredToken);

      expect(result).toHaveProperty('token');
      expect(result.user).toHaveProperty('_id', user._id);
    });

    it('rechaza un token invalidado por tokenVersion', async () => {
      const user = buildUser({ tokenVersion: 2 });
      const staleToken = jwt.sign(
        { id: user._id, role: user.role, tokenVersion: 0 },
        config.jwt.secret,
        { expiresIn: '1h', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );

      User.findById = jest.fn().mockResolvedValue(user);

      await expect(AuthUseCases.refreshToken(staleToken))
        .rejects.toThrow('Token invalidado. Inicia sesión nuevamente.');
    });
  });

  describe('changePassword', () => {
    it('actualiza la contraseña e invalida las sesiones', async () => {
      const oldHash = await bcrypt.hash('OldPassword123!', 4);
      const user = buildUser({ password: oldHash, tokenVersion: 1 });

      User.findById = jest.fn().mockReturnValue(findByIdResult(user));

      const result = await AuthUseCases.changePassword(
        user._id,
        'OldPassword123!',
        'NewPassword456!'
      );

      expect(result).toHaveProperty('message', 'Contraseña actualizada correctamente');
      expect(user.tokenVersion).toBe(2);
      expect(await bcrypt.compare('NewPassword456!', user.password)).toBe(true);
      expect(user.save).toHaveBeenCalled();
    });

    it('rechaza una contraseña actual incorrecta', async () => {
      const oldHash = await bcrypt.hash('OldPassword123!', 4);
      const user = buildUser({ password: oldHash });

      User.findById = jest.fn().mockReturnValue(findByIdResult(user));

      await expect(AuthUseCases.changePassword(user._id, 'Incorrecta', 'NewPassword456!'))
        .rejects.toThrow('Contraseña actual incorrecta');
    });

    it('rechaza un usuario inexistente', async () => {
      User.findById = jest.fn().mockReturnValue(findByIdResult(null));

      await expect(AuthUseCases.changePassword('no-existe', 'x', 'y'))
        .rejects.toThrow('Usuario no encontrado');
    });
  });
});
