from datetime import datetime, timedelta, timezone

from backend.validators import (
    validate_email,
    validate_jwt_not_expired,
    validate_login_not_blocked,
    validate_merma_motivo,
    validate_password_strength,
    validate_reversion_same_day,
    validate_stock_non_negative,
)


class TestValidateEmail:
    def test_valid_email(self):
        assert validate_email("usuario.test+ok@dominio.com") is True

    def test_invalid_email_missing_at(self):
        assert validate_email("usuario.dominio.com") is False

    def test_boundary_max_length_255(self):
        local = "a" * 64
        domain = f"{'b' * 63}.{'c' * 63}.{'d' * 59}.io"
        email = f"{local}@{domain}"
        assert len(email) == 255
        assert validate_email(email) is True


class TestValidatePasswordStrength:
    def test_valid_password(self):
        assert validate_password_strength("abc123") is True

    def test_invalid_password_only_letters(self):
        assert validate_password_strength("abcdef") is False

    def test_boundary_exactly_six_chars(self):
        assert validate_password_strength("a1b2c3") is True


class TestValidateStockNonNegative:
    def test_valid_stock_positive(self):
        assert validate_stock_non_negative(10) is True

    def test_invalid_stock_negative(self):
        assert validate_stock_non_negative(-0.01) is False

    def test_boundary_stock_zero(self):
        assert validate_stock_non_negative(0) is True


class TestValidateMermaMotivo:
    def test_valid_motivo(self):
        assert validate_merma_motivo("Producto dañado en traslado") is True

    def test_invalid_motivo_none(self):
        assert validate_merma_motivo(None) is False

    def test_boundary_motivo_whitespace_only(self):
        assert validate_merma_motivo("   \t  ") is False


class TestValidateLoginNotBlocked:
    def test_valid_not_blocked_none(self):
        assert validate_login_not_blocked(None) is True

    def test_invalid_when_blocked_in_future(self):
        future = datetime.now() + timedelta(minutes=10)
        assert validate_login_not_blocked(future) is False

    def test_boundary_when_block_time_equals_now(self):
        now = datetime.now()
        assert validate_login_not_blocked(now) is True


class TestValidateReversionSameDay:
    def test_valid_same_day(self):
        same_day = datetime.now().replace(hour=1, minute=0, second=0, microsecond=0)
        assert validate_reversion_same_day(same_day) is True

    def test_invalid_previous_day(self):
        yesterday = datetime.now() - timedelta(days=1)
        assert validate_reversion_same_day(yesterday) is False

    def test_boundary_timezone_aware_today(self):
        aware_now = datetime.now(timezone.utc)
        assert validate_reversion_same_day(aware_now) is True


class TestValidateJwtNotExpired:
    def test_valid_not_expired(self):
        future_ts = int(datetime.now().timestamp()) + 60
        assert validate_jwt_not_expired(future_ts) is True

    def test_invalid_expired(self):
        past_ts = int(datetime.now().timestamp()) - 60
        assert validate_jwt_not_expired(past_ts) is False

    def test_boundary_exact_now_timestamp(self):
        now_ts = int(datetime.now().timestamp())
        assert validate_jwt_not_expired(now_ts) is False
