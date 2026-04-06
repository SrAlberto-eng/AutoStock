# Manual de Usuario - AutoStock v1.0

## ¿Que es AutoStock?
AutoStock es un sistema de inventario orientado a control interno de almacenes y consumos por area.
Permite registrar entradas, salidas y mermas con trazabilidad de usuario y fecha.
Incluye lista de compras automatica para reposicion de stock y reportes operativos.
Su operacion es local en red loopback, ideal para entornos de demo, laboratorio o pyme.

## Roles y permisos

| Rol | Dashboard | Inventario | Compras | Reportes | Usuarios | Catalogos |
| --- | --- | --- | --- | --- | --- | --- |
| administrador | Si | Si | Si | Si | Si | Si |
| gerente | Si | Si | Si | Si | No | Si |
| encargado_area | Si | Si (operativo) | Si (consulta/uso) | No | No | No |
| encargado_compras | Si | Si (consulta) | Si | No | No | No |

## Guia por modulo

### Dashboard
- Para que sirve: ofrece un resumen rapido de salud de inventario y accesos directos a movimientos.
- Como registrar entrada/salida/merma: desde el panel de movimientos, selecciona tipo, producto, cantidad y motivo cuando aplique.
- Que muestran las tarjetas de alerta: productos agotados, productos bajo minimo y contadores operativos.

### Inventario General
- Para que sirve: centraliza el catalogo de productos, stock actual, umbrales y estado.
- Como agregar productos: crea primero categorias, areas y unidades; luego registra nombre, SKU y limites de stock.
- Como interpretar los estados de stock: Agotado (stock 0), Poca existencia (stock menor al minimo), Disponible (stock suficiente).

### Lista de Compras
- Para que sirve: prioriza reposicion segun faltantes y evita quiebres de inventario.
- Como generar la lista automaticamente: usa la accion Generar para detectar productos con stock por debajo del minimo.
- Como exportar: usa la opcion de exportacion para descargar la lista consolidada y compartirla.

### Reportes
- Para que sirve: permite auditoria operativa y seguimiento de movimientos historicos.
- Como filtrar movimientos: aplica filtros por tipo, producto y rango de fechas.
- Como exportar CSV: genera reporte filtrado y utiliza la opcion de exportacion disponible en la vista.

### Usuarios
- Para que sirve (solo administrador): administra cuentas, roles, estado activo y desbloqueo.
- Como crear usuarios: captura nombre, correo, password inicial y rol permitido.
- Como restablecer contrasena: ejecuta reset de password para obtener una clave temporal.

### Catalogos
- Para que sirve: mantiene tablas maestras (categorias, areas y unidades) usadas por inventario.
- Que pasa si eliminas una categoria con productos: el sistema bloquea la eliminacion para preservar integridad referencial.

## Preguntas frecuentes
- ¿Como recupero acceso si olvide mi contrasena?: solicita a un administrador un restablecimiento de password temporal.
- ¿Que pasa si registro una salida por error?: puedes corregir con una entrada compensatoria o usar reversion cuando aplique.
- ¿Como agrego un nuevo producto?: crea catalogos base y luego registra el producto desde Inventario.
- ¿Por que no veo todos los modulos?: el menu depende del rol asignado a tu usuario.
- ¿Como exporto el historial?: entra a Reportes, aplica filtros y usa la opcion de exportar.

## Solucion de problemas
- El sistema no carga: verifica que backend y frontend esten activos en puertos correctos.
- No puedo hacer login: confirma correo, contrasena y que la cuenta no este bloqueada.
- Un producto no aparece en inventario: revisa filtros activos y que el producto siga marcado como activo.
- La lista de compras esta vacia: valida que existan productos con stock por debajo del minimo.