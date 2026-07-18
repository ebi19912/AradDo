import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'services/auth_service')))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200

def test_register():
    response = client.post("/auth/register", json={"email": "test@example.com", "password": "password123"})
    if response.status_code == 400: # Already registered
        assert response.json()["detail"] == "Email already registered"
    else:
        assert response.status_code == 200
        assert "id" in response.json()
        assert response.json()["email"] == "test@example.com"

def test_login():
    response = client.post("/auth/login", data={"username": "test@example.com", "password": "password123"})
    assert response.status_code == 200
    assert "access_token" in response.json()
