from fastapi import HTTPException


def sanitize_string(value, max_length, field_name) -> str:
    if value is None or not str(value).strip():
        raise HTTPException(status_code=400, detail=f"{field_name} no puede estar vacío")

    cleaned = str(value).strip()
    if len(cleaned) > max_length:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} excede {max_length} caracteres",
        )

    return cleaned
