import os
import pytest
import requests
from datetime import datetime, timedelta
from jose import jwt

# Objetivo: probar que el listado de facturas no es vulnerable a inyección SQL.
# Para esto verificamos que un operator malicioso se ignore y que el parámetro "status" se construya de forma segura

BASE_URL = os.getenv("BACKEND_URL", "http://localhost:5000")  # URL del backend
SECRET = os.getenv("JWT_SECRET", "secreto_todavia_mas_seguro")  # Secreto para firmar el JWT de test (como lo definimos en el práctico anterior)


def make_token(uid: int = 1) -> str:
    # Creamos un JWT para el usuario de prueba que se genera con el seed.
    try:
        # Armamos el payload con id y expiración
        payload = {"id": uid, "exp": datetime.utcnow() + timedelta(hours=1)}
        # Firmamos el token
        return jwt.encode(payload, SECRET, algorithm="HS256")
    except Exception:
        # Si falta jose saltamos el test
        pytest.skip("Hay que instalar python-jose")


def auth(uid: int = 1):
    # Obtenemos el token y lo pasamos como bearer
    t = make_token(uid)
    return {"Authorization": f"Bearer {t}"}

# probamos inyección en "operator"
def test_operator_injection():
    # Pedimos la lista para el usuario 1 sin inyección
    res1 = requests.get(f"{BASE_URL}/invoices", headers=auth(), timeout=10)
    assert res1.ok, f"baseline list failed: {res1.status_code} {res1.text}"

    # Leemos JSON base (sin inyección)
    data1 = res1.json()

    # inyectamos en operator un OR 1=1 --
    # El resultado esperado es que el backend tenga allowlist y lo ignore.
    res2 = requests.get(
        f"{BASE_URL}/invoices",
        params={"status": "paid", "operator": "OR 1=1 --"},
        headers=auth(),
        timeout=10,
    )
    # Verificamos que el backend haya ignorado la inyección
    assert res2.ok, f"injection list failed: {res2.status_code} {res2.text}"

    # Json de la respuesta con intento de inyección
    data2 = res2.json()

    # Comparamos tamaño y alcance; no debería cambiar nada
    assert len(data2) == len(data1), "La inyección en operator cambió el tamaño del resultado. (posible SQLi)"
    # Verificamos que no haya datos de otros usuarios
    assert all(it.get("userId") == 1 for it in data2), "La inyección mostró datos de otros usuarios"


def test_status_injection():
    # Intentamos una inyección parecida pero en status
    # El resultado esperado es que se trate como texto literal gracias a la parametrización
    chanchada = "paid' OR '1'='1"

    # Le metemos un operador válido esta vez
    r = requests.get(
        f"{BASE_URL}/invoices",
        params={"status": chanchada, "operator": "="},
        headers=auth(),
        timeout=10,
    )
    assert r.ok, f"request failed: {r.status_code} {r.text}"

    # Guardamos el json de la respuesta
    data = r.json()

    # Si no viene vacío, el parámetro no se construyó de forma segura
    assert len(data) == 0, "El parámetro status no se construyó de forma segura (SQLi)"

