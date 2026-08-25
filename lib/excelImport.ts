import * as XLSX from "xlsx";

export function pick(row: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return null;
}

// Plantillas con título/instrucciones arriba de la tabla real (como las
// calculadoras de deuda) hacen que la fila de encabezados no siempre sea la
// primera. Busca, en cada hoja del archivo, la primera fila que contenga al
// menos un encabezado de nombre y uno de valor reconocibles, y arma los
// objetos de datos a partir de ahí.
export function extractRows(
  wb: XLSX.WorkBook,
  nameKeys: string[],
  amountKeys: string[]
): Record<string, any>[] {
  const headerKeys = [...nameKeys, ...amountKeys];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const raw: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(raw.length, 30); i++) {
      const cells = raw[i].map((c) => String(c).toLowerCase().trim());
      const hasName = cells.some((c) => nameKeys.includes(c));
      const hasAmount = cells.some((c) => amountKeys.includes(c));
      if (hasName && hasAmount) {
        headerRowIndex = i;
        break;
      }
    }
    if (headerRowIndex === -1) continue;

    const headers = raw[headerRowIndex].map((h) => String(h).toLowerCase().trim());
    const dataRows = raw.slice(headerRowIndex + 1);
    const rows = dataRows
      .map((r) => {
        const obj: Record<string, any> = {};
        headers.forEach((h, idx) => {
          if (h) obj[h] = r[idx];
        });
        return obj;
      })
      .filter((obj) => headerKeys.some((k) => obj[k] !== undefined && obj[k] !== ""));

    if (rows.length) return rows;
  }
  return [];
}
