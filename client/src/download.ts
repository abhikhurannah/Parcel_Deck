export function download(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function errorsCsv(errors: { row: number; message: string }[]) {
  return (
    'source_row,reason\r\n' +
    errors.map((e) => `${e.row},"${e.message.replaceAll('"', '""')}"`).join('\r\n')
  );
}
