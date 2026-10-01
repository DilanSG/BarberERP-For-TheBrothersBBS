/**
 * Migración de métodos de pago — reforma:
 * - Efectivo (cash) queda como ÚNICO método predeterminado del sistema.
 * - El resto de métodos pasan a ser dinámicos (isSystem: false) y se les
 *   asigna un color de la nueva paleta de 15.
 * - Se elimina el campo `emoji` de todos los documentos.
 *
 * No elimina ningún método ni registro: solo normaliza.
 *
 * Uso: node scripts/migrate-payment-methods.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';

// Paleta (nombre → hex) — debe coincidir con frontend/src/shared/utils/formatters.js
const PALETTE = {
  emerald: '#10b981',
  green: '#22c55e',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  pink: '#ec4899',
  rose: '#f43f5e',
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  brand: '#C6A664',
  gray: '#6b7280',
};

// Color asignado por método conocido (los actuales se convierten en dinámicos)
const METHOD_COLORS = {
  cash: PALETTE.emerald,
  tarjeta: PALETTE.blue,
  nequi: PALETTE.violet,
  daviplata: PALETTE.red,
  bancolombia: PALETTE.amber,
  nu: PALETTE.purple,
  digital: PALETTE.cyan,
};

const PALETTE_HEXES = Object.values(PALETTE).map((h) => h.toLowerCase());

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const methodsCol = db.collection('paymentmethods');

  console.log('Migrando métodos de pago...\n');

  // 1) Quitar emoji de todos los documentos
  const unset = await methodsCol.updateMany({}, { $unset: { emoji: '' } });
  console.log(`  1. emoji eliminado en ${unset.modifiedCount} método(s)`);

  // 2) Efectivo: único método del sistema
  const cash = await methodsCol.findOneAndUpdate(
    { backendId: 'cash' },
    {
      $set: {
        name: 'Efectivo',
        description: 'Pago en efectivo',
        color: PALETTE.emerald,
        category: 'cash',
        isSystem: true,
        isActive: true,
        displayOrder: 1,
        aliases: ['efectivo'],
      },
    },
    { returnDocument: 'after', upsert: true }
  );
  console.log(`  2. efectivo normalizado (isSystem: true)`);

  // 3) Resto: dinámicos + color de la paleta
  const others = await methodsCol.find({ backendId: { $ne: 'cash' } }).toArray();
  let converted = 0;
  let recolored = 0;
  for (const m of others) {
    const updates = { isSystem: false };
    const assigned = METHOD_COLORS[m.backendId];
    if (assigned) {
      updates.color = assigned;
      recolored++;
    } else if (!m.color || !PALETTE_HEXES.includes(String(m.color).toLowerCase())) {
      updates.color = PALETTE.gray; // color fuera de la paleta → gris neutro
      recolored++;
    }
    await methodsCol.updateOne(
      { _id: m._id },
      { $set: updates, $unset: { emoji: '' } }
    );
    converted++;
  }
  console.log(`  3. ${converted} método(s) convertidos a dinámicos (${recolored} con color de paleta)`);

  // 4) Reporte de uso (para saber qué se puede borrar con seguridad)
  const usage = {};
  for (const col of ['sales', 'appointments', 'expenses']) {
    const rows = await db.collection(col).aggregate([
      { $match: { paymentMethod: { $nin: [null, ''] } } },
      { $group: { _id: '$paymentMethod', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]).toArray();
    usage[col] = rows;
  }
  console.log('\n  Uso actual de métodos por colección:');
  for (const [col, rows] of Object.entries(usage)) {
    console.log(`   ${col}: ${rows.map((r) => `${r._id}(${r.n})`).join(', ') || '—'}`);
  }

  const final = await methodsCol.find({}).project({ backendId: 1, name: 1, color: 1, isSystem: 1 }).sort({ displayOrder: 1 }).toArray();
  console.log('\n  Métodos finales:');
  final.forEach((m) => console.log(`   - ${m.backendId} (${m.name}) ${m.color} ${m.isSystem ? '[SISTEMA]' : ''}`));

  await mongoose.disconnect();
  console.log('\nMigración completada');
};

run().catch((e) => {
  console.error('Error en migración:', e);
  process.exit(1);
});
