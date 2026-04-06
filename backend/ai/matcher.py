"""
matcher.py — Módulo de matching semántico para importación XML/CFDI 4.0.

Propósito:
    Resolver nombres inconsistentes entre facturas CFDI y el catálogo interno.
    Ejemplo: "LIMON PERSA KG", "LIM PERSA 1KG" y "Limones persa" deben sugerir
    el mismo producto del catálogo, reduciendo trabajo manual del usuario.

Stack (decidido en baseline §2, no modificar sin validación del equipo):
    Modelo    : paraphrase-multilingual-MiniLM-L12-v2
    Librería  : sentence-transformers (~120 MB)
    Requisito : CPU-only, 100% offline, soporte nativo de español
    Umbral    : 0.70 de similitud coseno (calibrar con facturas reales en producción)

Estado: PENDIENTE — implementar en Fase 4.
        NO instalar sentence-transformers todavía (setup inicial).

Notas de implementación (Fase 4):
    - El modelo se inicializa UNA SOLA VEZ al arrancar el sidecar.
    - cargar_catalogo() se llama al iniciar y cada vez que se modifica un producto.
    - Registrar si cada sugerencia fue aceptada o rechazada para calibración futura.
    - La UI pre-selecciona matches[0] si confianza >= 0.85 (menor umbral = manual).

Contrato del endpoint asociado (POST /api/importacion/preview):
    Response item:
    {
      "nombre_factura": "LIMON PERSA KG",
      "cantidad": "10",
      "unidad": "KG",
      "proveedor": "...",
      "matches": [
        {"nombre": "Limón persa", "confianza": 0.94},
        {"nombre": "Limón amarillo", "confianza": 0.71}
      ]
    }
"""

# from sentence_transformers import SentenceTransformer, util  # descomenta en Fase 4


class ProductMatcher:
    """
    Sugiere productos del catálogo para un nombre de factura dado.

    Uso (Fase 4):
        matcher = ProductMatcher()
        matcher.cargar_catalogo(["Limón persa", "Tomate Roma", ...])
        sugerencias = matcher.sugerir("LIMON PERSA KG")
        # → [{"nombre": "Limón persa", "confianza": 0.94}]
    """

    UMBRAL_SIMILITUD: float = 0.70
    UMBRAL_AUTO_SELECT: float = 0.85  # UI pre-selecciona si confianza >= este valor

    def __init__(self) -> None:
        # self.model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        self.catalogo_embeddings = None
        self.catalogo_nombres: list[str] = []
        self._initialized: bool = False

    def cargar_catalogo(self, nombres: list[str]) -> None:
        """
        Genera embeddings para todos los productos del catálogo.
        Debe llamarse al iniciar el sidecar y cada vez que se agregue/modifique
        un producto para mantener las sugerencias actualizadas.
        """
        # self.catalogo_nombres = nombres
        # self.catalogo_embeddings = self.model.encode(nombres, convert_to_tensor=True)
        # self._initialized = True
        raise NotImplementedError("ProductMatcher.cargar_catalogo se implementa en Fase 4.")

    def sugerir(self, nombre_factura: str, top_k: int = 3) -> list[dict]:
        """
        Retorna hasta top_k sugerencias para un nombre de factura.

        Args:
            nombre_factura: Nombre tal como aparece en el XML/CFDI.
            top_k: Máximo de sugerencias a retornar.

        Returns:
            Lista de dicts {"nombre": str, "confianza": float} donde
            confianza >= UMBRAL_SIMILITUD. Lista vacía si ningún match supera
            el umbral o si el catálogo no ha sido cargado.
        """
        # if not self._initialized:
        #     return []
        # query_embedding = self.model.encode(nombre_factura, convert_to_tensor=True)
        # scores = util.cos_sim(query_embedding, self.catalogo_embeddings)[0]
        # top = scores.topk(k=min(top_k, len(self.catalogo_nombres)))
        # return [
        #     {"nombre": self.catalogo_nombres[i], "confianza": round(float(s), 2)}
        #     for s, i in zip(top.values, top.indices)
        #     if float(s) >= self.UMBRAL_SIMILITUD
        # ]
        raise NotImplementedError("ProductMatcher.sugerir se implementa en Fase 4.")
