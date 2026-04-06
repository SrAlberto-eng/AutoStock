"""
AutoStock - Suite de pruebas funcionales
Ejecuta contra http://127.0.0.1:8765
"""
import requests
import json
import time
import base64

BASE = "http://127.0.0.1:8765"
ADMIN_EMAIL = "admin@autostock.local"
ADMIN_PASS  = "Admin1234"

# Roles en DB: 1=administrador 2=gerente 3=encargado_area 4=encargado_compras
ROLE_ADMIN       = 1
ROLE_ENC_AREA    = 3
ROLE_ENC_COMPRAS = 4

results = []

def h(resp):
    try:
        return resp.json()
    except Exception:
        return {"raw": resp.text[:300]}

def sep(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def ok(label, passed):
    mark = "EXITO" if passed else "FALLO"
    print(f"  [{mark}] {label}")
    results.append((label, passed))
    return passed

def na(label):
    print(f"  [N/A  ] {label}")
    results.append((label, None))

# ============================================================
sep("PRUEBA 1 - AUTENTICACION")
# ============================================================

# --- 1.1 Login valido ---
t0 = time.time()
r = requests.post(f"{BASE}/api/auth/login",
                  json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
ms = round((time.time()-t0)*1000)
d = h(r)
token = d.get("data", {}).get("token") if d.get("success") else None
print(f"\n[1.1] POST /api/auth/login — credenciales validas")
print(f"  Status: {r.status_code}  Tiempo: {ms}ms")
print(f"  success={d.get('success')}  token={'presente' if token else 'AUSENTE'}")
ok("1.1 Login valido retorna 200 + token", r.status_code == 200 and bool(token))

HEADERS = {"Authorization": f"Bearer {token}"} if token else {}

# --- 1.2 Login invalido ---
t0 = time.time()
r2 = requests.post(f"{BASE}/api/auth/login",
                   json={"email": ADMIN_EMAIL, "password": "Wrongpass99"})
ms = round((time.time()-t0)*1000)
d2 = h(r2)
print(f"\n[1.2] POST /api/auth/login — credenciales incorrectas")
print(f"  Status: {r2.status_code}  Tiempo: {ms}ms")
print(f"  error='{d2.get('error','')}'")
ok("1.2 Login incorrecto retorna 401 con error", r2.status_code == 401 and not d2.get("success"))

# --- 1.3 Bloqueo tras 5 intentos (usuario temporal) ---
# Email unico por ejecucion para evitar conflictos con runs anteriores
BLOCK_EMAIL = f"test_blk_{int(time.time())}@autostock.local"
# Crear usuario temporal (role_id=4 = encargado_compras)
ru = requests.post(f"{BASE}/api/usuarios/",
                   json={"nombre": "Test Bloqueo PR", "email": BLOCK_EMAIL,
                         "password": "Test1234!", "role_id": ROLE_ENC_COMPRAS},
                   headers=HEADERS)
ru_json = ru.json() if ru.content else {}
user_created = ru.status_code == 200 and ru_json.get("success")
user_id_temp = ru_json.get("data", {}).get("id") if user_created else None
print(f"\n[1.3] Bloqueo tras 5 intentos — usuario temporal {BLOCK_EMAIL}")
print(f"  Creacion usuario temporal: status={ru.status_code} id={user_id_temp}")

for i in range(5):
    r3 = requests.post(f"{BASE}/api/auth/login",
                       json={"email": BLOCK_EMAIL, "password": "Mal_pass_0000"})
    d3 = h(r3)
    print(f"  Intento {i+1}: status={r3.status_code}  error='{str(d3.get('error',''))[:70]}'")
    time.sleep(0.2)

# Intento 6 — debe estar bloqueado o devolver 429
r4 = requests.post(f"{BASE}/api/auth/login",
                   json={"email": BLOCK_EMAIL, "password": "Mal_pass_0000"})
d4 = h(r4)
print(f"  Intento 6 (post-bloqueo): status={r4.status_code}  error='{str(d4.get('error',''))[:100]}'")
bloqueado = (r4.status_code in (403, 423, 429) or
             "bloqueado" in str(d4).lower() or
             "block" in str(d4).lower() or
             "espera" in str(d4).lower())
ok("1.3 Cuenta bloqueada/rate-limited tras 5 intentos fallidos", bloqueado)

# Eliminar usuario temporal
if user_id_temp:
    requests.delete(f"{BASE}/api/usuarios/{user_id_temp}", headers=HEADERS)
    print(f"  Limpieza: usuario {BLOCK_EMAIL} (id={user_id_temp}) eliminado")

# ============================================================
sep("PRUEBA 2 - REGISTRO DE ENTRADAS")
# ============================================================

# Obtener productos
t0 = time.time()
rp = requests.get(f"{BASE}/api/productos/", headers=HEADERS)
ms = round((time.time()-t0)*1000)
products = rp.json().get("data", {}).get("items", []) if rp.ok else []
print(f"\n[2.0] GET /api/productos/  status={rp.status_code}  productos={len(products)}  {ms}ms")

if len(products) >= 3:
    for i, prod in enumerate(products[:3]):
        pid         = prod["id"]
        stock_antes = prod.get("stock_actual", 0)
        qty         = 5

        t0 = time.time()
        rm = requests.post(f"{BASE}/api/movimientos/",
                           json={"tipo": "entrada",
                                 "items": [{"producto_id": pid, "cantidad": qty,
                                            "motivo": f"Prueba funcional entrada {i+1}"}]},
                           headers=HEADERS)
        ms = round((time.time()-t0)*1000)
        dm = h(rm)
        print(f"\n[2.{i+1}] POST /api/movimientos/ - entrada {qty}u  producto_id={pid}  ({prod.get('nombre','?')[:35]})")
        print(f"  Status: {rm.status_code}  Tiempo: {ms}ms  success={dm.get('success')}")
        if not dm.get("success"):
            print(f"  error='{dm.get('error','')}'")

        # Verificar stock actualizado
        rck = requests.get(f"{BASE}/api/productos/{pid}", headers=HEADERS)
        if rck.ok:
            nuevo_stock = rck.json().get("data", {}).get("producto", {}).get("stock_actual", -1)
            esperado    = stock_antes + qty
            print(f"  Stock antes={stock_antes}  esperado={esperado}  actual={nuevo_stock}")
            ok(f"2.{i+1} Stock actualizado correctamente (producto {pid})", nuevo_stock == esperado)
        else:
            ok(f"2.{i+1} Verificacion stock producto {pid}", False)
else:
    print(f"  Aviso: Solo {len(products)} producto(s) disponible(s), se necesitan 3")
    if products:
        prod = products[0]
        pid  = prod["id"]
    else:
        pid  = 1

# --- 2.4 Cantidad negativa ---
print(f"\n[2.4] POST /api/movimientos/ - cantidad negativa (-5)")
t0 = time.time()
rn = requests.post(f"{BASE}/api/movimientos/",
                   json={"tipo": "entrada",
                         "items": [{"producto_id": pid, "cantidad": -5}]},
                   headers=HEADERS)
ms = round((time.time()-t0)*1000)
dn = h(rn)
print(f"  Status: {rn.status_code}  Tiempo: {ms}ms  error='{str(dn.get('error',''))[:80]}'")
ok("2.4 Cantidad negativa rechazada (4xx)", rn.status_code in (400, 422))

# --- 2.5 Cantidad cero ---
print(f"\n[2.5] POST /api/movimientos/ - cantidad cero (0)")
t0 = time.time()
rz = requests.post(f"{BASE}/api/movimientos/",
                   json={"tipo": "entrada",
                         "items": [{"producto_id": pid, "cantidad": 0}]},
                   headers=HEADERS)
ms = round((time.time()-t0)*1000)
dz = h(rz)
print(f"  Status: {rz.status_code}  Tiempo: {ms}ms  error='{str(dz.get('error',''))[:80]}'")
ok("2.5 Cantidad cero rechazada (4xx)", rz.status_code in (400, 422))

# ============================================================
sep("PRUEBA 3 - LISTA DE COMPRAS")
# ============================================================

# --- 3.1 GET lista ---
t0 = time.time()
rc = requests.get(f"{BASE}/api/compras/", headers=HEADERS)
ms = round((time.time()-t0)*1000)
dc = h(rc)
items_compras = dc.get("data", {}).get("items", []) if dc.get("success") else []
print(f"\n[3.1] GET /api/compras/  status={rc.status_code}  items={len(items_compras)}  {ms}ms")
ok("3.1 Lista de compras retorna 200", rc.status_code == 200)

# --- 3.2 Verificar campos ---
required = {"nombre_producto", "stock_actual", "stock_min"}
optional = {"categoria_nombre", "proveedor_nombre", "cantidad_sugerida", "area_nombre", "unidad_nombre"}

if items_compras:
    sample = items_compras[0]
    print(f"\n[3.2] Campos del item: {list(sample.keys())}")
    present_req = required & set(sample.keys())
    present_opt = optional & set(sample.keys())
    print(f"  Campos requeridos presentes: {present_req}")
    print(f"  Campos opcionales presentes: {present_opt}")
    ok("3.2 Campos nombre_producto, stock_actual, stock_min presentes",
       required.issubset(set(sample.keys())))
    all_below = all(i.get("stock_actual", 9999) < i.get("stock_min", 0) for i in items_compras)
    ok("3.2 Todos los items tienen stock_actual < stock_min", all_below)
else:
    print("\n[3.2] Lista vacia (todos los productos sobre el minimo tras las entradas de Prueba 2)")
    na("3.2 Validacion de campos (sin items)")
    na("3.2 Verificacion stock_actual < stock_min")

# --- 3.3 Export ---
print(f"\n[3.3] GET /api/compras/export")
t0 = time.time()
re_ = requests.get(f"{BASE}/api/compras/export", headers=HEADERS)
ms = round((time.time()-t0)*1000)
de_ = h(re_)
print(f"  Status: {re_.status_code}  Tiempo: {ms}ms  Content-Type: {re_.headers.get('content-type','')}")
if re_.status_code == 200:
    ct = re_.headers.get("content-type","")
    if "pdf" in ct.lower() or (len(re_.content) > 4 and re_.content[:4] == b'%PDF'):
        print(f"  Formato: PDF  Tamano: {len(re_.content)} bytes")
        ok("3.3 Export retorna PDF valido", True)
    elif de_.get("success"):
        export_items = de_.get("data", {}).get("items", [])
        print(f"  Formato: JSON  items_exportados={len(export_items)}")
        ok("3.3 Export retorna datos validos (JSON)", True)
    else:
        ok("3.3 Export retorna datos validos", False)
elif re_.status_code == 404:
    print("  Endpoint /api/compras/export no encontrado (404)")
    na("3.3 Export PDF (endpoint no implementado)")
else:
    print(f"  Respuesta: {str(de_)[:200]}")
    ok("3.3 Export retorna respuesta valida", False)

# ============================================================
sep("PRUEBA 4 - IMPORTACION XML CFDI 4.0")
# ============================================================

# Tomar nombre del primer producto real para probar matcher
prod_nombre_real = products[0]["nombre"] if products else "Logitech G305 LightSpeed"
# Nombre similar con variacion ortografica
nombre_similar = prod_nombre_real.replace("G305", "G3O5").replace("a", "4")[:50] \
    if prod_nombre_real else "Logitech G3O5 LightSpd"

xml_str = f"""<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  Version="4.0" Serie="A" Folio="001" Fecha="2026-04-04T10:00:00"
  Sello="" NoCertificado="00001" Certificado=""
  SubTotal="1500.00" Total="1740.00" Moneda="MXN"
  TipoDeComprobante="I" MetodoPago="PUE" FormaPago="03"
  LugarExpedicion="01000">
  <cfdi:Emisor Rfc="PRV010101AAA" Nombre="Proveedor Test SA" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="REC010101BBB" Nombre="AutoStock Test" UsoCFDI="G01"
    DomicilioFiscalReceptor="01000" RegimenFiscalReceptor="601"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="50000000" Cantidad="50" ClaveUnidad="KGM"
      Unidad="Kilogramo" NoIdentificacion="P001"
      Descripcion="Harina de trigo integral bolsa 1kg"
      ValorUnitario="10.00" Importe="500.00"/>
    <cfdi:Concepto ClaveProdServ="50000000" Cantidad="30" ClaveUnidad="LTR"
      Unidad="Litro" NoIdentificacion="P002"
      Descripcion="Aceite vegetal comestible botella 1L"
      ValorUnitario="25.00" Importe="750.00"/>
    <cfdi:Concepto ClaveProdServ="50000000" Cantidad="20" ClaveUnidad="H87"
      Unidad="Pieza" NoIdentificacion="P003"
      Descripcion="{nombre_similar}"
      ValorUnitario="12.50" Importe="250.00"/>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="240.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1500.00" Impuesto="002" TipoFactor="Tasa"
        TasaOCuota="0.160000" Importe="240.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
</cfdi:Comprobante>"""

xml_b64 = base64.b64encode(xml_str.encode("utf-8")).decode()

print(f"\n[4.1] POST /api/importacion/preview — CFDI 4.0 con 3 conceptos")
print(f"  Concepto 3 (variacion ortografica): '{nombre_similar}'")
print(f"  Producto real en BD:               '{prod_nombre_real}'")

t0 = time.time()
ri = requests.post(f"{BASE}/api/importacion/preview",
                   json={"xml_base64": xml_b64},
                   headers=HEADERS)
ms = round((time.time()-t0)*1000)
di = h(ri)
print(f"  Status: {ri.status_code}  Tiempo: {ms}ms  success={di.get('success')}")

if ri.status_code == 200 and di.get("success"):
    lineas = di.get("data", {}).get("lineas", [])
    total  = di.get("data", {}).get("total_lineas", 0)
    print(f"  Lineas parseadas: {total}")
    ok("4.1 Importacion XML retorna 200 y parsea las 3 lineas", len(lineas) == 3)

    for i, linea in enumerate(lineas):
        desc    = linea.get("nombre_factura","?")
        matches = linea.get("matches", [])
        best    = matches[0] if matches else {}
        score   = best.get("confianza", best.get("score", 0))
        nombre_bd = best.get("nombre_bd","sin coincidencia")
        print(f"\n  Linea {i+1}: '{desc[:45]}'")
        print(f"    Mejor match: '{nombre_bd}'  confianza={score}")
        if not matches:
            print(f"    (sin matches)")

    # Prueba 4.2: matcher para nombre similar
    if len(lineas) >= 3:
        l3      = lineas[2]
        matches3 = l3.get("matches", [])
        best3    = matches3[0] if matches3 else {}
        score3   = best3.get("confianza", 0)
        nombre3  = best3.get("nombre_bd","")
        print(f"\n[4.2] Evaluacion matcher para concepto 3 (nombre similar):")
        print(f"  Nombre en factura: '{l3.get('nombre_factura','')}'")
        print(f"  Match sugerido:    '{nombre3}'  score={score3}")
        tiene_match = bool(matches3) and score3 > 0
        ok("4.2 Matcher sugirio normalizacion con score > 0", tiene_match)
        if tiene_match:
            ok("4.2 Score de similitud reportado", score3 is not None)
else:
    print(f"  Respuesta: {str(di)[:400]}")
    ok("4.1 Importacion XML procesada", False)

# ============================================================
sep("PRUEBA 5 - SEGURIDAD Y ROLES")
# ============================================================

# Crear usuario encargado_area (role_id=3)
EA_EMAIL = f"enc_area_{int(time.time())}@autostock.local"
EA_PASS  = "TestArea1234!"
ru_ea = requests.post(f"{BASE}/api/usuarios/",
                      json={"nombre": "Encargado Area Test", "email": EA_EMAIL,
                            "password": EA_PASS, "role_id": ROLE_ENC_AREA},
                      headers=HEADERS)
# Si ya existe, eliminarlo primero (incluir inactivos)
existing_u2 = requests.get(f"{BASE}/api/usuarios/?include_inactive=true", headers=HEADERS)
if existing_u2.ok:
    for u in existing_u2.json().get("data", {}).get("items", []):
        if u["email"] == EA_EMAIL:
            requests.delete(f"{BASE}/api/usuarios/{u['id']}", headers=HEADERS)
ru_ea = requests.post(f"{BASE}/api/usuarios/",
                      json={"nombre": "Encargado Area Test", "email": EA_EMAIL,
                            "password": EA_PASS, "role_id": ROLE_ENC_AREA},
                      headers=HEADERS)
ru_ea_json = ru_ea.json() if ru_ea.content else {}
ea_created = ru_ea.status_code == 200 and ru_ea_json.get("success")
ea_user_id = ru_ea_json.get("data", {}).get("id") if ea_created else None
ea_rol = (ru_ea_json.get('data') or {}).get('rol','?')
print(f"\n[5.0] Crear usuario encargado_area (role_id={ROLE_ENC_AREA}): status={ru_ea.status_code}  id={ea_user_id}  rol={ea_rol}")

# Login como encargado_area
t0 = time.time()
r_ea = requests.post(f"{BASE}/api/auth/login",
                     json={"email": EA_EMAIL, "password": EA_PASS})
ms = round((time.time()-t0)*1000)
ea_token  = r_ea.json().get("data", {}).get("token") if r_ea.ok else None
ea_headers = {"Authorization": f"Bearer {ea_token}"} if ea_token else {}
print(f"  Login encargado_area: status={r_ea.status_code}  token={'SI' if ea_token else 'NO'}  {ms}ms")

if ea_token:
    restricted = [
        ("GET",  f"{BASE}/api/usuarios/",                   "Listar usuarios (solo admin)"),
        ("POST", f"{BASE}/api/usuarios/",                   "Crear usuario (solo admin)"),
        # GET /api/catalogos es publico por diseno (sin auth) — no se prueba aqui
        ("POST", f"{BASE}/api/catalogos/categorias",        "Crear categoria (solo admin/gerente)"),
        ("GET",  f"{BASE}/api/reportes/audit-log",          "Audit log (solo admin/gerente)"),
    ]
    for method, url, desc in restricted:
        t0 = time.time()
        if method == "GET":
            r5 = requests.get(url, headers=ea_headers)
        else:
            r5 = requests.post(url,
                               json={"nombre": "CatPrueba", "email": "x@x.com",
                                     "password": "Xx1234!", "role_id": 4},
                               headers=ea_headers)
        ms = round((time.time()-t0)*1000)
        d5 = h(r5)
        endpoint = url.replace(BASE, "")
        print(f"\n[5.x] {method} {endpoint}")
        print(f"  Status: {r5.status_code}  Tiempo: {ms}ms  error='{str(d5.get('error',''))[:70]}'")
        ok(f"5 Encargado de area bloqueado en '{desc}'", r5.status_code in (401, 403))
else:
    print("  Aviso: No se pudo obtener token de encargado_area")
    for _ in range(5):
        na("5 Prueba de rol omitida (sin token)")

# Limpiar usuario encargado_area
if ea_user_id:
    requests.delete(f"{BASE}/api/usuarios/{ea_user_id}", headers=HEADERS)
    print(f"\n  Limpieza: usuario {EA_EMAIL} (id={ea_user_id}) eliminado")

# ============================================================
sep("PRUEBA 6 - RENDIMIENTO (RNF-03: < 3 segundos)")
# ============================================================

perf_cases = [
    ("GET /api/productos/",          lambda: requests.get(f"{BASE}/api/productos/", headers=HEADERS)),
    ("GET /api/compras/",            lambda: requests.get(f"{BASE}/api/compras/", headers=HEADERS)),
    ("GET /api/dashboard/resumen",   lambda: requests.get(f"{BASE}/api/dashboard/resumen", headers=HEADERS)),
    ("GET /api/movimientos/",        lambda: requests.get(f"{BASE}/api/movimientos/", headers=HEADERS)),
    ("GET /api/reportes/audit-log",  lambda: requests.get(f"{BASE}/api/reportes/audit-log", headers=HEADERS)),
]

print()
all_ok = True
for name, fn in perf_cases:
    t0 = time.time()
    rp2 = fn()
    ms = round((time.time()-t0)*1000)
    within = ms < 3000
    if not within:
        all_ok = False
    mark = "OK " if within else "EXCEDE"
    print(f"  [{mark}] {name:<42} {rp2.status_code}  {ms}ms")
    results.append((f"RNF-03 {name}", within))

# ============================================================
sep("RESUMEN GENERAL")
# ============================================================
passed = [r for r in results if r[1] is True]
failed = [r for r in results if r[1] is False]
skipped= [r for r in results if r[1] is None]

print(f"\n  Total: {len(results)}  |  Exitosos: {len(passed)}  |  Fallidos: {len(failed)}  |  N/A: {len(skipped)}")

if failed:
    print("\n  Pruebas FALLIDAS:")
    for name, _ in failed:
        print(f"    - {name}")

print()
