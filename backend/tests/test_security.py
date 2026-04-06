# REQUISITO: estos tests requieren el backend corriendo en http://127.0.0.1:8765

import base64
import time
import uuid

import pytest
import requests

BASE_URL = "http://127.0.0.1:8765"
TIMEOUT = 20


@pytest.fixture(scope="module")
def token():
    response = _login_with_retry("admin@autostock.local", "Admin1234")
    assert response.status_code == 200
    return response.json()["data"]["token"]


@pytest.fixture
def headers(token):
    return {"Authorization": f"Bearer {token}"}


def _suffix(prefix: str = "sec") -> str:
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


def test_sql_injection_en_nombre(headers):
    payload = {"nombre": "'; DROP TABLE productos;--"}
    response = requests.post(
        f"{BASE_URL}/api/catalogos/categorias",
        json=payload,
        headers=headers,
        timeout=TIMEOUT,
    )
    assert response.status_code in (200, 400)

    health_products = requests.get(f"{BASE_URL}/api/productos", timeout=TIMEOUT)
    assert health_products.status_code == 200


def test_xss_en_nombre(headers):
    xss_value = f"<script>alert(1)</script> {_suffix('xss')}"
    created = requests.post(
        f"{BASE_URL}/api/catalogos/categorias",
        json={"nombre": xss_value},
        headers=headers,
        timeout=TIMEOUT,
    )
    assert created.status_code == 200

    listed = requests.get(
        f"{BASE_URL}/api/catalogos/categorias",
        headers=headers,
        timeout=TIMEOUT,
    )
    assert listed.status_code == 200
    items = listed.json().get("data", {}).get("items", [])
    assert any(item.get("nombre") == xss_value for item in items)


def test_sin_token():
    response = requests.get(f"{BASE_URL}/api/reportes/audit-log", timeout=TIMEOUT)
    assert response.status_code == 401


def test_xxe_en_xml(token):
    xml_payload = (
        "<?xml version=\"1.0\"?><!DOCTYPE foo "
        "[<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]>"
        "<root>&xxe;</root>"
    )
    xml_base64 = base64.b64encode(xml_payload.encode("utf-8")).decode("ascii")

    response = requests.post(
        f"{BASE_URL}/api/importacion/preview",
        json={"xml_base64": xml_base64},
        timeout=TIMEOUT,
    )
    assert response.status_code == 400


def test_acceso_sin_permiso(headers):
    email = f"{_suffix('encargado')}@autostock.local"
    password = "AreaPass123"

    created = requests.post(
        f"{BASE_URL}/api/usuarios",
        json={
            "nombre": f"Encargado {_suffix()}",
            "email": email,
            "password": password,
            "rol": "encargado_area",
        },
        headers=headers,
        timeout=TIMEOUT,
    )
    assert created.status_code == 200

    login = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=TIMEOUT,
    )
    if login.status_code == 429:
        login = _login_with_retry(email, password)
    assert login.status_code == 200
    user_token = login.json().get("data", {}).get("token")
    assert user_token

    forbidden = requests.get(
        f"{BASE_URL}/api/reportes/movimientos",
        headers={"Authorization": f"Bearer {user_token}"},
        timeout=TIMEOUT,
    )
    assert forbidden.status_code == 403


def test_rate_limiting_login():
    last_status = None
    for _ in range(11):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "admin@autostock.local", "password": "NoValida123"},
            timeout=TIMEOUT,
        )
        last_status = response.status_code
    assert last_status == 429
