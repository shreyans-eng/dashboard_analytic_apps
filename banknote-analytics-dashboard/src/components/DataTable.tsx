interface Props {
  rows: Record<string, unknown>[];
}

export default function DataTable({ rows }: Props) {
  if (!rows.length) return <p className="loading">No results</p>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="results-table-wrap">
      <table className="results-table">
        <thead>
          <tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c}>{String(row[c] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
