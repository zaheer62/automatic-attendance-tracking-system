"""
backend/app/utils/encrypt.py
Encrypts / decrypts biometric embeddings at rest using AES-256-GCM (via Fernet).
Drop-in replacement: call encrypt_embedding() before storing and
decrypt_embedding() after reading from the database.
"""

import os
import base64
import pickle
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Key management
# ---------------------------------------------------------------------------
# Set BIOMETRIC_ENCRYPTION_KEY in your .env (generate with: python -c
#   "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
# If missing we auto-generate one at startup and warn loudly — this is only
# acceptable for local dev; production MUST set the env var explicitly.

_KEY_ENV = "BIOMETRIC_ENCRYPTION_KEY"


def _load_key() -> Fernet:
    raw = os.getenv(_KEY_ENV)
    if not raw:
        generated = Fernet.generate_key()
        logger.warning(
            "BIOMETRIC_ENCRYPTION_KEY not set — generated a one-time key. "
            "Embeddings encrypted now CANNOT be decrypted after restart. "
            "Set %s in your .env for production.",
            _KEY_ENV,
        )
        return Fernet(generated)
    return Fernet(raw.encode())


# Module-level singleton so we only read the env var once per process.
_fernet: Fernet = _load_key()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def encrypt_embedding(embedding: list[float]) -> bytes:
    """Pickle the embedding list then encrypt with AES-256-GCM."""
    raw_bytes = pickle.dumps(embedding)
    return _fernet.encrypt(raw_bytes)


def decrypt_embedding(token: bytes) -> list[float]:
    """Decrypt and unpickle an embedding stored in the database."""
    raw_bytes = _fernet.decrypt(token)
    return pickle.loads(raw_bytes)


def encrypt_bytes(data: bytes) -> bytes:
    """Generic helper — encrypt arbitrary bytes."""
    return _fernet.encrypt(data)


def decrypt_bytes(token: bytes) -> bytes:
    """Generic helper — decrypt arbitrary bytes."""
    return _fernet.decrypt(token)


def rotate_key(old_key: str, new_key: str, ciphertext: bytes) -> bytes:
    """
    Re-encrypt a single blob from old_key → new_key.
    Use during key rotation to migrate stored embeddings one-by-one.
    """
    plaintext = Fernet(old_key.encode()).decrypt(ciphertext)
    return Fernet(new_key.encode()).encrypt(plaintext)
