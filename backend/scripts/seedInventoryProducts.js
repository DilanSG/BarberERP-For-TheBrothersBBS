import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Inventory from '../src/core/domain/entities/Inventory.js';
import { logger } from '../src/shared/utils/logger.js';

// Cargar variables de entorno
dotenv.config();

// Conectar a MongoDB
await mongoose.connect(process.env.MONGODB_URI);
logger.info('Conectado a MongoDB para poblar inventario');

// Función para generar código único basado en categoría y nombre
const generateCode = (category, name, index) => {
  const categoryCode = category.substring(0, 3).toUpperCase();
  const nameCode = name.replace(/\s+/g, '').substring(0, 5).toUpperCase();
  return `${categoryCode}-${nameCode}-${String(index + 1).padStart(3, '0')}`;
};

// Productos según la tabla proporcionada
const productos = [
  // Geles
  { name: 'Gel 1000g', description: 'Gel para cabello presentación de 1000 gramos, fijación fuerte', category: 'geles', location: 'vitrina_grande_1', initialStock: 25, entries: 0, exits: 0, minStock: 5, unit: 'unidad', price: 15000, priority: 'normal' },
  { name: 'Gel 500g', description: 'Gel para cabello presentación de 500 gramos, fijación media', category: 'geles', location: 'vitrina_grande_1', initialStock: 30, entries: 0, exits: 0, minStock: 8, unit: 'unidad', price: 8500, priority: 'normal' },
  { name: 'Gel 250g', description: 'Gel para cabello presentación de 250 gramos, fijación ligera', category: 'geles', location: 'vitrina_grande_1', initialStock: 35, entries: 0, exits: 0, minStock: 10, unit: 'unidad', price: 5000, priority: 'normal' },
  { name: 'Gel 120g', description: 'Gel para cabello presentación de 120 gramos, tamaño personal', category: 'geles', location: 'vitrina_grande_1', initialStock: 40, entries: 0, exits: 0, minStock: 12, unit: 'unidad', price: 3500, priority: 'normal' },

  // Ceras
  { name: 'Cera GOD BARBER Amarilla', description: 'Cera para cabello GOD BARBER color amarilla, fijación extra fuerte', category: 'ceras', location: 'vitrina_grande_1', initialStock: 20, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 12000, priority: 'alta' },
  { name: 'Cera GOD BARBER Rosada', description: 'Cera para cabello GOD BARBER color rosada, fijación media', category: 'ceras', location: 'vitrina_grande_1', initialStock: 18, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 12000, priority: 'alta' },
  { name: 'Cera GOD BARBER morada', description: 'Cera para cabello GOD BARBER color morada, fijación fuerte', category: 'ceras', location: 'vitrina_grande_1', initialStock: 22, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 12000, priority: 'alta' },
  { name: 'Cera BARBER FAMILY Minoxidil', description: 'Cera BARBER FAMILY con minoxidil para crecimiento del cabello', category: 'ceras', location: 'vitrina_grande_1', initialStock: 15, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 18000, priority: 'alta' },
  { name: 'Cera MR BUFFEL Clasic', description: 'Cera MR BUFFEL presentación clásica, fijación natural', category: 'ceras', location: 'vitrina_grande_1', initialStock: 25, entries: 0, exits: 0, minStock: 5, unit: 'unidad', price: 10000, priority: 'normal' },
  { name: 'Cera MR BUFFEL Sandia', description: 'Cera MR BUFFEL aroma sandía, fijación media con fragancia', category: 'ceras', location: 'vitrina_grande_1', initialStock: 20, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 11000, priority: 'normal' },
  { name: 'Cera MR BUFFEL Minoxidil Morada', description: 'Cera MR BUFFEL con minoxidil color morada para crecimiento', category: 'ceras', location: 'vitrina_grande_1', initialStock: 12, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 16000, priority: 'alta' },
  { name: 'Cera MR BUFFEL Minoxidil Negra', description: 'Cera MR BUFFEL con minoxidil color negra para crecimiento', category: 'ceras', location: 'vitrina_grande_1', initialStock: 14, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 16000, priority: 'alta' },
  { name: 'Cera MR BUFFEL Minoxidil roja', description: 'Cera MR BUFFEL con minoxidil color roja para crecimiento', category: 'ceras', location: 'vitrina_grande_1', initialStock: 13, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 16000, priority: 'alta' },
  { name: 'Cera Barberos', description: 'Cera tradicional para barberos, fijación profesional', category: 'ceras', location: 'vitrina_grande_1', initialStock: 30, entries: 0, exits: 0, minStock: 6, unit: 'unidad', price: 8000, priority: 'normal' },
  { name: 'Cera MORFOSE Amarilla', description: 'Cera MORFOSE color amarilla, fijación extra fuerte', category: 'ceras', location: 'vitrina_grande_1', initialStock: 16, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 14000, priority: 'normal' },
  { name: 'Cera MORFOSE Azul', description: 'Cera MORFOSE color azul, fijación fuerte con brillo', category: 'ceras', location: 'vitrina_grande_1', initialStock: 18, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 14000, priority: 'normal' },
  { name: 'Cera ROTERBART', description: 'Cera ROTERBART premium, fijación profesional duradera', category: 'ceras', location: 'vitrina_grande_1', initialStock: 10, entries: 0, exits: 0, minStock: 2, unit: 'unidad', price: 20000, priority: 'alta' },
  { name: 'Cera para barba Roldan', description: 'Cera especial para barba marca Roldan, cuidado y fijación', category: 'ceras', location: 'vitrina_grande_1', initialStock: 15, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 12000, priority: 'normal' },

  // Lociones
  { name: 'Locion Tormund', description: 'Loción after shave Tormund, refrescante y antiséptica', category: 'lociones', location: 'vitrina_grande_1', initialStock: 25, entries: 0, exits: 0, minStock: 5, unit: 'unidad', price: 8000, priority: 'normal' },
  { name: 'Locion Tormund grande', description: 'Loción after shave Tormund presentación grande', category: 'lociones', location: 'vitrina_grande_1', initialStock: 15, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 12000, priority: 'normal' },
  { name: 'Locion INVICTUS', description: 'Loción INVICTUS con fragancia masculina intensa', category: 'lociones', location: 'vitrina_grande_1', initialStock: 20, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 15000, priority: 'normal' },
  { name: 'Locion HBOS', description: 'Loción HBOS premium con aroma exclusivo', category: 'lociones', location: 'vitrina_grande_1', initialStock: 18, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 16000, priority: 'normal' },
  { name: 'Locion LACOS VERDE', description: 'Loción LACOS VERDE con aroma fresco y natural', category: 'lociones', location: 'vitrina_grande_1', initialStock: 22, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 14000, priority: 'normal' },
  { name: 'Locion CRIEED', description: 'Loción CRIEED con fragancia sofisticada', category: 'lociones', location: 'vitrina_grande_1', initialStock: 16, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 18000, priority: 'normal' },
  { name: 'Locion 212 VIP', description: 'Loción 212 VIP con aroma exclusivo y elegante', category: 'lociones', location: 'vitrina_grande_1', initialStock: 12, entries: 0, exits: 0, minStock: 2, unit: 'unidad', price: 25000, priority: 'alta' },
  { name: 'Locion PHANTOM Paco Rabane', description: 'Loción PHANTOM de Paco Rabanne, fragancia premium', category: 'lociones', location: 'vitrina_grande_1', initialStock: 8, entries: 0, exits: 0, minStock: 2, unit: 'unidad', price: 35000, priority: 'alta' },
  { name: 'Locion TOY BOY', description: 'Loción TOY BOY con aroma juvenil y fresco', category: 'lociones', location: 'vitrina_grande_1', initialStock: 14, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 22000, priority: 'normal' },
  { name: 'Locion BAD', description: 'Loción BAD con fragancia intensa y duradera', category: 'lociones', location: 'vitrina_grande_1', initialStock: 16, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 20000, priority: 'normal' },
  { name: "Locion LEE'AU DIS'SSEY", description: "Loción L'EAU D'ISSEY con aroma acuático y elegante", category: 'lociones', location: 'vitrina_grande_1', initialStock: 10, entries: 0, exits: 0, minStock: 2, unit: 'unidad', price: 30000, priority: 'alta' },

  // Otros productos de peluquería
  { name: 'Talcos cabello', description: 'Talcos especiales para cabello, absorbe grasa y da textura', category: 'productos_pelo', location: 'vitrina_grande_1', initialStock: 35, entries: 0, exits: 0, minStock: 8, unit: 'unidad', price: 6000, priority: 'normal' },
  { name: 'Foligan Minoxidil', description: 'Foligan con minoxidil para crecimiento del cabello', category: 'productos_pelo', location: 'vitrina_grande_1', initialStock: 20, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 25000, priority: 'alta' },
  { name: 'Mascarilla Puntos negros Sobres', description: 'Mascarilla en sobres individuales para eliminar puntos negros', category: 'productos_pelo', location: 'vitrina_grande_1', initialStock: 50, entries: 0, exits: 0, minStock: 10, unit: 'unidad', price: 2000, priority: 'normal' },
  { name: 'Mascarilla Puntos negros', description: 'Mascarilla facial para eliminar puntos negros', category: 'productos_pelo', location: 'vitrina_grande_1', initialStock: 25, entries: 0, exits: 0, minStock: 5, unit: 'unidad', price: 8000, priority: 'normal' },
  { name: 'Laca ROTERBART', description: 'Laca ROTERBART para fijación extra fuerte del peinado', category: 'productos_pelo', location: 'vitrina_grande_1', initialStock: 20, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 12000, priority: 'normal' },
  { name: 'Laca MORFOSE', description: 'Laca MORFOSE para fijación media del peinado', category: 'productos_pelo', location: 'vitrina_grande_1', initialStock: 25, entries: 0, exits: 0, minStock: 5, unit: 'unidad', price: 10000, priority: 'normal' },
  { name: 'Gel De Afeitar GOD BARBER', description: 'Gel de afeitar GOD BARBER para un afeitado suave', category: 'geles', location: 'vitrina_grande_1', initialStock: 30, entries: 0, exits: 0, minStock: 6, unit: 'unidad', price: 9000, priority: 'normal' },

  // Máquinas y herramientas
  { name: 'Maquina 3 en 1', description: 'Máquina multifuncional 3 en 1 para corte, barba y detalles', category: 'maquinas', location: 'vitrina_grande_1', initialStock: 5, entries: 0, exits: 0, minStock: 1, unit: 'unidad', price: 150000, priority: 'alta' },

  // Productos de la vitrina pequeña - Gorras
  { name: 'Gorras planas 38', description: 'Gorras planas talla 38, diseño clásico', category: 'gorras', location: 'vitrina_pequeña_1', initialStock: 15, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 25000, priority: 'normal' },
  { name: 'Gorras planas 35', description: 'Gorras planas talla 35, diseño clásico', category: 'gorras', location: 'vitrina_pequeña_1', initialStock: 18, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 23000, priority: 'normal' },

  // Productos cannabicos
  { name: 'Blones Sabores en caja', description: 'Blones con sabores variados presentación en caja', category: 'cannabicos', location: 'vitrina_pequeña_1', initialStock: 50, entries: 0, exits: 0, minStock: 10, unit: 'unidad', price: 1500, priority: 'normal' },
  { name: 'Blones PAPEL FINO', description: 'Blones de papel fino para uso premium', category: 'cannabicos', location: 'vitrina_pequeña_1', initialStock: 40, entries: 0, exits: 0, minStock: 8, unit: 'unidad', price: 2000, priority: 'normal' },
  { name: 'Blones x2', description: 'Pack de 2 blones económicos', category: 'cannabicos', location: 'vitrina_pequeña_1', initialStock: 60, entries: 0, exits: 0, minStock: 12, unit: 'unidad', price: 1200, priority: 'normal' },
  { name: 'Blones x3', description: 'Pack de 3 blones económicos', category: 'cannabicos', location: 'vitrina_pequeña_1', initialStock: 45, entries: 0, exits: 0, minStock: 9, unit: 'unidad', price: 1800, priority: 'normal' },

  // Accesorios
  { name: 'CLIPPERS', description: 'Clippers profesionales para corte de cabello', category: 'maquinas', location: 'vitrina_pequeña_1', initialStock: 8, entries: 0, exits: 0, minStock: 2, unit: 'unidad', price: 80000, priority: 'alta' },
  { name: 'Pipas De Vidrio de 6', description: 'Pipas de vidrio de 6 cm, diseño clásico', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 25, entries: 0, exits: 0, minStock: 5, unit: 'unidad', price: 8000, priority: 'normal' },
  { name: 'Pipas Diseños de 6', description: 'Pipas de 6 cm con diseños especiales', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 20, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 10000, priority: 'normal' },

  // Trilladoras
  { name: 'Trilladora 3500', description: 'Trilladora modelo 3500, alta calidad', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 12, entries: 0, exits: 0, minStock: 2, unit: 'unidad', price: 35000, priority: 'alta' },
  { name: 'Trilladora 15', description: 'Trilladora modelo 15, tamaño compacto', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 18, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 15000, priority: 'normal' },
  { name: 'Trilladora 18', description: 'Trilladora modelo 18, tamaño mediano', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 15, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 18000, priority: 'normal' },
  { name: 'Trilladora 20', description: 'Trilladora modelo 20, tamaño estándar', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 14, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 20000, priority: 'normal' },
  { name: 'Trilladora 28', description: 'Trilladora modelo 28, tamaño grande', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 10, entries: 0, exits: 0, minStock: 2, unit: 'unidad', price: 28000, priority: 'normal' },
  { name: 'Trilladora 32', description: 'Trilladora modelo 32, tamaño extra grande', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 8, entries: 0, exits: 0, minStock: 2, unit: 'unidad', price: 32000, priority: 'alta' },

  // Otros accesorios
  { name: 'Cenicero', description: 'Cenicero de cristal para uso personal', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 30, entries: 0, exits: 0, minStock: 6, unit: 'unidad', price: 5000, priority: 'baja' },
  { name: 'Porcelana 35', description: 'Porcelana decorativa modelo 35', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 12, entries: 0, exits: 0, minStock: 2, unit: 'unidad', price: 35000, priority: 'baja' },
  { name: 'Pipas de vidrio de 10', description: 'Pipas de vidrio de 10 cm, tamaño grande', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 15, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 12000, priority: 'normal' },
  { name: 'Pipas de vidrio 8', description: 'Pipas de vidrio de 8 cm, tamaño mediano', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 20, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 10000, priority: 'normal' },
  { name: 'Pipa de chupo', description: 'Pipa especial tipo chupo, diseño único', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 18, entries: 0, exits: 0, minStock: 4, unit: 'unidad', price: 7000, priority: 'normal' },
  { name: 'Pipa bala 3.5', description: 'Pipa tipo bala de 3.5 cm, diseño compacto', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 25, entries: 0, exits: 0, minStock: 5, unit: 'unidad', price: 6000, priority: 'normal' },
  { name: 'Pipa diseños 3.5', description: 'Pipa de 3.5 cm con diseños especiales', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 22, entries: 0, exits: 0, minStock: 5, unit: 'unidad', price: 7000, priority: 'normal' },
  { name: 'Pipa bate 6', description: 'Pipa tipo bate de 6 cm, diseño deportivo', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 16, entries: 0, exits: 0, minStock: 3, unit: 'unidad', price: 9000, priority: 'normal' },
  { name: 'Pipa 1.5', description: 'Pipa mini de 1.5 cm, muy compacta', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 35, entries: 0, exits: 0, minStock: 7, unit: 'unidad', price: 3000, priority: 'normal' },
  { name: 'Pipa 2', description: 'Pipa pequeña de 2 cm, tamaño personal', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 30, entries: 0, exits: 0, minStock: 6, unit: 'unidad', price: 4000, priority: 'normal' },
  { name: 'Pipa 7.5', description: 'Pipa grande de 7.5 cm, uso premium', category: 'accesorios', location: 'vitrina_pequeña_1', initialStock: 12, entries: 0, exits: 0, minStock: 2, unit: 'unidad', price: 15000, priority: 'normal' }
];

async function poblarInventario() {
  try {
    // Limpiar inventario existente
    await Inventory.deleteMany({});
    logger.info('Inventario anterior eliminado');

    // Insertar nuevos productos
    for (let i = 0; i < productos.length; i++) {
      const producto = productos[i];
      
      // Generar código único usando la función
      const codigo = generateCode(producto.category, producto.name, i);
      
      // Calcular stock final
      const stockFinal = producto.initialStock + producto.entries - producto.exits;
      
      const nuevoProducto = new Inventory({
        code: codigo,
        name: producto.name,
        description: producto.description,
        category: producto.category,
        location: producto.location,
        initialStock: producto.initialStock,
        entries: producto.entries,
        exits: producto.exits,
        stock: stockFinal,
        minStock: producto.minStock,
        unit: producto.unit,
        price: producto.price,
        priority: producto.priority,
        isActive: true
      });

      await nuevoProducto.save();
      logger.info(`Producto creado: ${producto.name}`);
    }

    logger.info(`Inventario poblado exitosamente con ${productos.length} productos`);
    console.log(`Inventario poblado exitosamente con ${productos.length} productos`);

  } catch (error) {
    logger.error('Error al poblar inventario:', error);
    console.error('Error al poblar inventario:', error.message);
  } finally {
    await mongoose.disconnect();
    logger.info('Desconectado de MongoDB');
  }
}

// Ejecutar el script
poblarInventario();
