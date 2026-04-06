# REQUISITO: estos tests requieren el backend corriendo en http://127.0.0.1:8765

import subprocess
import time
import uuid

import pytest
import requests

BASE_URL = "http://127.0.0.1:8765"
TIMEOUT = 20


@pytest.fixture(scope="module")
def auth_token():
    subprocess.run(["python", "backend/scripts/reset_db.py"], check=True)
    response = _login_with_retry("admin@autostock.local", "Admin1234")
    assert response.status_code == 200
    payload = response.json()
    return payload["data"]["token"]


@pytest.fixture(scope="module", autouse=True)
def _bootstrap_auth(auth_token):
    return auth_token


@pytest.fixture
def headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


def _suffix(prefix: str = "qa") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _login_with_retry(email, password, attempts=15, sleep_seconds=5):
    last = None
    for _ in range(attempts):
        last = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            timeout=TIMEOUT,
        )
        if last.status_code != 429:
            return last
        time.sleep(sleep_seconds)
    return last


def _create_categoria(headers, nombre=None):
    nombre = nombre or f"Categoria {_suffix()}"
    response = requests.post(
        f"{BASE_URL}/api/catalogos/categorias",
        json={"nombre": nombre},
        headers=headers,
        timeout=TIMEOUT,
    )
    return response


def _ensure_area(headers):
    nombre = f"Area {_suffix()}"
    response = requests.post(
        f"{BASE_URL}/api/catalogos/areas",
        json={"nombre": nombre},
        headers=headers,
        timeout=TIMEOUT,
    )
    assert response.status_code == 200
    return response.json()["data"]["id"]


def _ensure_unidad(headers):
    nombre = f"Unidad {_suffix()}"
    abreviacion = _suffix("u")[:6]
    response = requests.post(
        f"{BASE_URL}/api/catalogos/unidades",
        json={"nombre": nombre, "abreviacion": abreviacion},
        headers=headers,
        timeout=TIMEOUT,
    )
    assert response.status_code == 200
    return response.json()["data"]["id"]


def _create_producto(headers, stock_min=1, stock_max=10):
    categoria_resp = _create_categoria(headers)
    assert categoria_resp.status_code == 200
    categoria_id = categoria_resp.json()["data"]["id"]

    area_id = _ensure_area(headers)
    unidad_id = _ensure_unidad(headers)

    payload = {
        "nombre": f"Producto {_suffix()}",
        "sku": _suffix("SKU").upper(),
        "categoria_id": categoria_id,
        "area_id": area_id,
        "unidad_id": unidad_id,
        "proveedor_id": None,
        "stock_min": stock_min,
        "stock_max": stock_max,
    }
    response = requests.post(
        f"{BASE_URL}/api/productos",
        json=payload,
        headers=headers,
        timeout=TIMEOUT,
    )
    assert response.status_code == 200
    return response.json()["data"]


def _producto_detalle(producto_id):
    response = requests.get(f"{BASE_URL}/api/productos/{producto_id}", timeout=TIMEOUT)
    assert response.status_code == 200
    return response.json()["data"]["producto"]


def _crear_movimiento(headers, tipo, producto_id, cantidad, motivo_general=None, area_id=None):
    body = {
        "tipo": tipo,
        "items": [{"producto_id": producto_id, "cantidad": cantidad}],
    }
    if motivo_general is not None:
        body["motivo_general"] = motivo_general
    if area_id is not None:
        body["area_id"] = area_id

    return requests.post(
        f"{BASE_URL}/api/movimientos",
        json=body,
        headers=headers,
        timeout=TIMEOUT,
    )


class TestAuth:
    def test_login_correcto(self):
        response = _login_with_retry("admin@autostock.local", "Admin1234")
        assert response.status_code == 200
        data = response.json().get("data", {})
        assert data.get("token")

    def test_login_incorrecto(self):
        response = _login_with_retry("admin@autostock.local", "Incorrecta123")
        assert response.status_code == 401

    def test_sin_token_en_endpoint_protegido(self):
        response = requests.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert response.status_code == 401

    def test_token_invalido(self):
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer token-invalido"},
            timeout=TIMEOUT,
        )
        assert response.status_code == 401


class TestCatalogos:
    def test_crear_categoria(self, headers):
        response = _create_categoria(headers)
        assert response.status_code == 200
        assert response.json().get("data", {}).get("id") is not None

    def test_crear_categoria_duplicada(self, headers):
        nombre = f"Categoria {_suffix()}"
        first = _create_categoria(headers, nombre=nombre)
        second = _create_categoria(headers, nombre=nombre)
        assert first.status_code == 200
        assert second.status_code == 409

    def test_crear_categoria_nombre_vacio(self, headers):
        response = requests.post(
            f"{BASE_URL}/api/catalogos/categorias",
            json={"nombre": "   "},
            headers=headers,
            timeout=TIMEOUT,
        )
        assert response.status_code == 400

    def test_crud_completo_area(self, headers):
        create = requests.post(
            f"{BASE_URL}/api/catalogos/areas",
            json={"nombre": f"Area {_suffix()}"},
            headers=headers,
            timeout=TIMEOUT,
        )
        assert create.status_code == 200
        area_id = create.json()["data"]["id"]

        patch = requests.patch(
            f"{BASE_URL}/api/catalogos/areas/{area_id}",
            json={"nombre": f"Area Editada {_suffix()}"},
            headers=headers,
            timeout=TIMEOUT,
        )
        assert patch.status_code == 200

        delete = requests.delete(
            f"{BASE_URL}/api/catalogos/areas/{area_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert delete.status_code == 200


class TestProductos:
    def test_crear_producto(self, headers):
        producto = _create_producto(headers)
        assert producto["id"] is not None
        assert producto["estado"] == "Agotado"

    def test_sku_duplicado(self, headers):
        categoria_resp = _create_categoria(headers)
        assert categoria_resp.status_code == 200
        categoria_id = categoria_resp.json()["data"]["id"]
        area_id = _ensure_area(headers)
        unidad_id = _ensure_unidad(headers)

        sku = _suffix("SKU-DUP").upper()
        payload = {
            "nombre": f"Producto {_suffix()}",
            "sku": sku,
            "categoria_id": categoria_id,
            "area_id": area_id,
            "unidad_id": unidad_id,
            "proveedor_id": None,
            "stock_min": 1,
            "stock_max": 10,
        }
        first = requests.post(
            f"{BASE_URL}/api/productos", json=payload, headers=headers, timeout=TIMEOUT
        )
        second = requests.post(
            f"{BASE_URL}/api/productos", json=payload, headers=headers, timeout=TIMEOUT
        )
        assert first.status_code == 200
        assert second.status_code == 409

    def test_stock_no_negativo(self, headers):
        producto = _create_producto(headers)
        response = requests.patch(
            f"{BASE_URL}/api/productos/{producto['id']}",
            json={"stock_actual": -1},
            headers=headers,
            timeout=TIMEOUT,
        )
        assert response.status_code == 400

    def test_estado_cambia_con_stock(self, headers):
        producto = _create_producto(headers)
        assert producto["estado"] == "Agotado"

        patched = requests.patch(
            f"{BASE_URL}/api/productos/{producto['id']}",
            json={"stock_actual": 10},
            headers=headers,
            timeout=TIMEOUT,
        )
        assert patched.status_code == 200
        assert patched.json()["data"]["estado"] == "Disponible"


class TestMovimientos:
    def test_entrada_aumenta_stock(self, headers):
        producto = _create_producto(headers)
        move = _crear_movimiento(headers, "entrada", producto["id"], 5)
        assert move.status_code == 200

        detalle = _producto_detalle(producto["id"])
        assert detalle["stock_actual"] == 5

    def test_salida_disminuye_stock(self, headers):
        producto = _create_producto(headers)
        in_move = _crear_movimiento(headers, "entrada", producto["id"], 5)
        assert in_move.status_code == 200

        out_move = _crear_movimiento(headers, "salida", producto["id"], 3, area_id=producto["area_id"])
        assert out_move.status_code == 200

        detalle = _producto_detalle(producto["id"])
        assert detalle["stock_actual"] == 2

    def test_salida_stock_insuficiente(self, headers):
        producto = _create_producto(headers)
        move = _crear_movimiento(headers, "salida", producto["id"], 1, area_id=producto["area_id"])
        assert move.status_code == 409

    def test_merma_sin_motivo(self, headers):
        producto = _create_producto(headers)
        _crear_movimiento(headers, "entrada", producto["id"], 5)
        move = _crear_movimiento(headers, "merma", producto["id"], 1)
        assert move.status_code == 400

    def test_merma_con_motivo(self, headers):
        producto = _create_producto(headers)
        _crear_movimiento(headers, "entrada", producto["id"], 5)
        move = _crear_movimiento(headers, "merma", producto["id"], 1, motivo_general="Producto dañado")
        assert move.status_code == 200

    def test_reversion_entrada_bloqueada(self, headers):
        producto = _create_producto(headers)
        entrada = _crear_movimiento(headers, "entrada", producto["id"], 2)
        assert entrada.status_code == 200

        audit = requests.get(
            f"{BASE_URL}/api/reportes/audit-log",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert audit.status_code == 200
        audit_items = audit.json().get("data", {}).get("items", [])
        entrada_id = next(
            (
                item.get("entidad_id")
                for item in audit_items
                if item.get("entidad") == "movimiento" and item.get("accion") == "entrada"
            ),
            None,
        )
        assert entrada_id is not None

        revert = requests.post(
            f"{BASE_URL}/api/movimientos/{entrada_id}/revertir",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert revert.status_code in (400, 403)


class TestUsuarios:
    def test_crear_usuario_rol_valido(self, headers):
        payload = {
            "nombre": f"Usuario {_suffix()}",
            "email": f"{_suffix('usuario')}@autostock.local",
            "password": "TempPass123",
            "rol": "encargado_compras",
        }
        response = requests.post(
            f"{BASE_URL}/api/usuarios",
            json=payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert response.status_code == 200

    def test_crear_usuario_rol_invalido(self, headers):
        payload = {
            "nombre": f"Usuario {_suffix()}",
            "email": f"{_suffix('invalido')}@autostock.local",
            "password": "TempPass123",
            "rol": "rol_inexistente",
        }
        response = requests.post(
            f"{BASE_URL}/api/usuarios",
            json=payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert response.status_code == 400

    def test_reset_password(self, headers):
        payload = {
            "nombre": f"Usuario {_suffix()}",
            "email": f"{_suffix('reset')}@autostock.local",
            "password": "TempPass123",
            "rol": "encargado_area",
        }
        created = requests.post(
            f"{BASE_URL}/api/usuarios",
            json=payload,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert created.status_code == 200
        user_id = created.json()["data"]["id"]

        reset = requests.post(
            f"{BASE_URL}/api/usuarios/{user_id}/password",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert reset.status_code == 200
        assert reset.json().get("data", {}).get("password_temporal")

    def test_eliminar_ultimo_admin_bloqueado(self, headers):
        login = _login_with_retry("admin@autostock.local", "Admin1234")
        assert login.status_code == 200
        admin_id = login.json()["data"]["user_id"]

        delete = requests.delete(
            f"{BASE_URL}/api/usuarios/{admin_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert delete.status_code in (400, 403)


class TestCompras:
    def test_generar_lista(self, headers):
        producto = _create_producto(headers, stock_min=5, stock_max=20)

        generated = requests.post(
            f"{BASE_URL}/api/compras/generar",
            timeout=TIMEOUT,
        )
        assert generated.status_code == 200

        listed = requests.get(f"{BASE_URL}/api/compras", timeout=TIMEOUT)
        assert listed.status_code == 200
        items = listed.json().get("data", {}).get("items", [])
        assert any(item.get("producto_id") == producto["id"] for item in items)

    def test_editar_cantidad(self, headers):
        producto = _create_producto(headers, stock_min=5, stock_max=20)
        gen = requests.post(f"{BASE_URL}/api/compras/generar", timeout=TIMEOUT)
        assert gen.status_code == 200

        listed = requests.get(f"{BASE_URL}/api/compras", timeout=TIMEOUT)
        assert listed.status_code == 200
        item = next(
            (i for i in listed.json().get("data", {}).get("items", []) if i.get("producto_id") == producto["id"]),
            None,
        )
        assert item is not None

        patch = requests.patch(
            f"{BASE_URL}/api/compras/{item['id']}",
            json={"cantidad_ajustada": 12},
            timeout=TIMEOUT,
        )
        assert patch.status_code == 200
        assert patch.json().get("data", {}).get("cantidad_ajustada") == 12

    def test_eliminar_item_no_afecta_inventario(self, headers):
        producto = _create_producto(headers, stock_min=5, stock_max=20)
        gen = requests.post(f"{BASE_URL}/api/compras/generar", timeout=TIMEOUT)
        assert gen.status_code == 200

        listed = requests.get(f"{BASE_URL}/api/compras", timeout=TIMEOUT)
        assert listed.status_code == 200
        item = next(
            (i for i in listed.json().get("data", {}).get("items", []) if i.get("producto_id") == producto["id"]),
            None,
        )
        assert item is not None

        before = _producto_detalle(producto["id"])["stock_actual"]

        deleted = requests.delete(f"{BASE_URL}/api/compras/{item['id']}", timeout=TIMEOUT)
        assert deleted.status_code == 200

        after = _producto_detalle(producto["id"])["stock_actual"]
        assert before == after


class TestReportes:
    def test_historial_movimientos(self, headers):
        producto = _create_producto(headers)
        _crear_movimiento(headers, "entrada", producto["id"], 2)

        report = requests.get(
            f"{BASE_URL}/api/reportes/movimientos",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert report.status_code == 200
        assert isinstance(report.json().get("data", {}).get("items", []), list)

    def test_filtro_por_tipo(self, headers):
        producto = _create_producto(headers)
        _crear_movimiento(headers, "entrada", producto["id"], 1)

        report = requests.get(
            f"{BASE_URL}/api/reportes/movimientos",
            params={"tipo": "entrada"},
            headers=headers,
            timeout=TIMEOUT,
        )
        assert report.status_code == 200
        items = report.json().get("data", {}).get("items", [])
        assert items
        assert all(item.get("tipo") == "entrada" for item in items)

    def test_audit_log(self, headers):
        report = requests.get(
            f"{BASE_URL}/api/reportes/audit-log",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert report.status_code == 200
        assert isinstance(report.json().get("data", {}).get("items", []), list)
