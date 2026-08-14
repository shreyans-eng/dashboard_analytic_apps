import { useEffect, useState } from 'react';
import DataTable from '@/components/DataTable';
import { listSqlFiles, loadSqlFile, runCustomSql, QueryParams, SqlFile } from '@/lib/api';

interface Props {
  params: QueryParams;
}

const DEFAULT_SQL = `-- Banknote AI Analytics — SQL Editor
-- Edit and run any BigQuery SQL against analytics views

SELECT
  event_date,
  COUNT(DISTINCT resolved_user_id) AS dau
FROM \`banknote-app-4f3fd.analytics_488476338.v_daily_active_users\`
WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY event_date
ORDER BY event_date;
`;

export default function SqlEditorPage({ params }: Props) {
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [files, setFiles] = useState<SqlFile[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [executedSql, setExecutedSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listSqlFiles().then(setFiles).catch(() => {});
  }, []);

  const loadFile = async (f: SqlFile) => {
    try {
      const content = await loadSqlFile(f.dir, f.name);
      setSql(content);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  };

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await runCustomSql(sql, params);
      setRows(result.rows);
      setExecutedSql(result.sql);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const grouped = files.reduce<Record<string, SqlFile[]>>((acc, f) => {
    (acc[f.dir] ||= []).push(f);
    return acc;
  }, {});

  return (
    <>
      <div className="page-header">
        <div>
          <h2>SQL Editor</h2>
          <p>Run BigQuery SQL against the active product dataset</p>
        </div>
      </div>
      <div className="page-content">
        <div className="sql-layout">
          <div className="sql-files">
            <h4>Query library</h4>
            {Object.entries(grouped).map(([dir, dirFiles]) => (
              <div key={dir}>
                <h4>{dir}/</h4>
                {dirFiles.map((f) => (
                  <button key={f.path} className="sql-file-btn" onClick={() => loadFile(f)}>
                    {f.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="sql-editor-panel">
            <textarea
              className="sql-textarea"
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              spellCheck={false}
            />
            <div className="sql-actions">
              <button onClick={run} disabled={loading}>
                {loading ? 'Running…' : '▶ Run Query'}
              </button>
              <button className="secondary" onClick={() => setSql(DEFAULT_SQL)}>Reset</button>
            </div>
            {error && <div className="error">{error}</div>}
            {executedSql && (
              <>
                <div className="results-meta">{rows.length} rows returned</div>
                <pre className="executed-sql">{executedSql}</pre>
              </>
            )}
            {!loading && rows.length > 0 && <DataTable rows={rows} />}
          </div>
        </div>
      </div>
    </>
  );
}
