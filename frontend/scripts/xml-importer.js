/**
 * xml-importer.js
 * Utilidades compartidas para importar y parsear archivos XML en cualquier
 * formulario de la aplicación.
 *
 * API pública:
 *   readXmlFile(file)                        → Promise<{ doc, error }>
 *   xmlAttrOrChild(node, ...names)           → string (primer match entre atributo o elemento hijo)
 *   initXmlDropzone(options)                 → void
 *
 * Opciones de initXmlDropzone:
 *   {
 *     dropzoneId  : string   – id del elemento dropzone
 *     inputId     : string   – id del <input type="file"> oculto
 *     btnId       : string   – id del botón "Cargar XML"
 *     fileNameId ?: string   – id del elemento donde mostrar el nombre del archivo (opcional)
 *     onFile      : (file: File) => void  – callback con el archivo seleccionado
 *   }
 */

// ── Lectura y validación de XML ───────────────────────────────────────────
/**
 * Lee un File, valida la extensión y lo parsea con DOMParser.
 * @returns {Promise<{doc: Document|null, error: string|null}>}
 */
async function readXmlFile(file) {
  if (!file.name.toLowerCase().endsWith('.xml')) {
    return { doc: null, error: 'Selecciona un archivo .xml válido' };
  }
  try {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) {
      return { doc: null, error: 'El archivo XML no tiene un formato válido' };
    }
    return { doc, error: null };
  } catch {
    return { doc: null, error: 'Error al leer el archivo XML' };
  }
}

// ── Lectura flexible de nodos ─────────────────────────────────────────────
/**
 * Intenta leer un valor de un nodo XML probando cada nombre en `names`
 * primero como atributo y luego como elemento hijo.
 * Devuelve el primer valor no vacío encontrado.
 *
 * @param {Element} node
 * @param {...string} names  – nombres de atributo / etiqueta a probar
 * @returns {string}
 */
function xmlAttrOrChild(node, ...names) {
  if (!node) return '';
  for (const name of names) {
    const attr = node.getAttribute(name);
    if (attr !== null && attr !== '') return attr;
    const child = node.querySelector(name);
    if (child) return child.textContent.trim();
  }
  return '';
}

// ── Dropzone genérico ─────────────────────────────────────────────────────
/**
 * Conecta un dropzone visual con un <input type="file"> oculto y un botón.
 * Soporta: clic en dropzone, clic en botón, teclado (Enter/Espacio),
 *          arrastrar y soltar, y re-selección del mismo archivo.
 *
 * @param {{ dropzoneId: string, inputId: string, btnId: string, fileNameId?: string, onFile: Function }} options
 */
function initXmlDropzone({ dropzoneId, inputId, btnId, fileNameId, onFile }) {
  const dropzone = document.getElementById(dropzoneId);
  const input    = document.getElementById(inputId);
  const btn      = document.getElementById(btnId);
  if (!dropzone || !input || !btn) return;

  const openPicker = () => input.click();

  // Botón: abre picker sin propagar el clic al dropzone
  btn.addEventListener('click', e => { e.stopPropagation(); openPicker(); });

  // Dropzone: abre picker al hacer clic en cualquier área
  dropzone.addEventListener('click', openPicker);

  // Accesibilidad por teclado
  dropzone.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker(); }
  });

  // Selección de archivo
  input.addEventListener('change', () => {
    const file = input.files[0];
    input.value = ''; // permite re-seleccionar el mismo archivo
    if (!file) return;
    _showFileName(fileNameId, file.name);
    onFile(file);
  });

  // Drag & drop
  dropzone.addEventListener('dragenter', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragover',  e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', ()  => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    _showFileName(fileNameId, file.name);
    onFile(file);
  });
}

function _showFileName(fileNameId, name) {
  if (!fileNameId) return;
  const el = document.getElementById(fileNameId);
  if (el) el.textContent = name;
}
