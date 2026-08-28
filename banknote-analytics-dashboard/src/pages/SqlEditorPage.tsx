import { FormEvent, useEffect, useMemo, useState } from 'react';
import DataTable from '@/components/DataTable';
import FilterBar from '@/components/FilterBar';
import { useToast } from '@/lib/toast';
import {
  createSavedQuery,
  deleteSavedQuery,
  importSavedQueries,
  listSavedQueries,
  loadSavedQuery,
  revertSavedQuery,
  runCustomSql,
  saveSavedQuery,
  QueryParams,
  SavedQuery,
} from '@/lib/api';

interface Props {
  params: QueryParams;
  setParams: (p: QueryParams) => void;
  applyFilters: () => void;
}

const BLANK_SQL = `-- New query
-- Placeholders: {{start_date}} {{end_date}}  {PROJECT} {DATASET}

SELECT 1 AS ok;
`;

export default function SqlEditorPage({ params, setParams, applyFilters }: Props) {
  const toast = useToast();
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [mongo, setMongo] = useState(true);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPath, setSelectedPath] = useState('');
  const [sql, setSql] = useState(BLANK_SQL);
  const [meta, setMeta] = useState<SavedQuery | null>(null);
  const [dirtyLocal, setDirtyLocal] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [executedSql, setExecutedSql] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const refreshList = async () => {
    const data = await listSavedQueries();
    setMongo(data.mongo);
    setQueries(data.queries || []);
    setNotice(data.message || '');
    return data.queries || [];
  };

  useEffect(() => {
    refreshList().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load queries'));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return queries;
    return queries.filter((item) =>
      `${item.path} ${item.name} ${item.dir}`.toLowerCase().includes(q),
    );
  }, [queries, search]);

  const grouped = useMemo(() => {
    const acc: Record<string, SavedQuery[]> = {};
    for (const item of filtered) {
      (acc[item.dir] ||= []).push(item);
    }
    return acc;
  }, [filtered]);

  const openQuery = async (path: string) => {
    setError('');
    try {
      const row = await loadSavedQuery(path);
      setSelectedPath(row.path);
      setSql(row.sql || '');
      setMeta(row);
      setDirtyLocal(false);
      setRows([]);
      setExecutedSql('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  };

  const save = async () => {
    if (!selectedPath) return;
    setSaving(true);
    setError('');
    try {
      const { query } = await saveSavedQuery(selectedPath, sql);
      setMeta(query);
      setDirtyLocal(false);
      await refreshList();
      toast.success('Saved', 'Dashboard tabs will use this SQL. Cache was cleared.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const revert = async () => {
    if (!selectedPath) return;
    setSaving(true);
    setError('');
    try {
      const { query } = await revertSavedQuery(selectedPath);
      setSql(query.sql || '');
      setMeta(query);
      setDirtyLocal(false);
      await refreshList();
      toast.success('Reverted', 'Restored the copy from disk.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revert failed');
    } finally {
      setSaving(false);
    }
  };

  const importAll = async (force: boolean) => {
    setImporting(true);
    setError('');
    try {
      const result = await importSavedQueries(force);
      setMongo(result.mongo !== false);
      setQueries(result.queries || []);
      toast.success(
        'Imported from disk',
        `${result.inserted || 0} new, ${result.updated || 0} updated, ${result.skipped || 0} kept (already edited).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const createNew = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { query } = await createSavedQuery(newName, BLANK_SQL);
      setShowNew(false);
      setNewName('');
      await refreshList();
      await openQuery(query.path);
      toast.success('Created', query.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  };

  const removeCustom = async () => {
    if (!selectedPath || meta?.source !== 'custom') return;
    if (!window.confirm(`Delete ${selectedPath}?`)) return;
    setError('');
    try {
      await deleteSavedQuery(selectedPath);
      setSelectedPath('');
      setMeta(null);
      setSql(BLANK_SQL);
      await refreshList();
      toast.success('Deleted');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
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

  const edited = dirtyLocal || Boolean(meta?.dirty);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Query library</h2>
          <p>
            All dashboard SQL in one place. Admins and anyone granted this tab can edit.
            Saved copies live in Mongo and override the files on disk.
          </p>
        </div>
        <FilterBar params={params} onChange={setParams} onApply={applyFilters} />
      </div>
      <div className="page-content">
        {!mongo && notice && <div className="page-hint">{notice}</div>}
        <div className="sql-toolbar">
          <button type="button" onClick={() => importAll(false)} disabled={importing || !mongo}>
            {importing ? 'Importing…' : 'Add all queries from disk'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => importAll(true)}
            disabled={importing || !mongo}
            title="Overwrites edited queries with the files in the repo"
          >
            Re-import (overwrite edits)
          </button>
          <button type="button" className="secondary" onClick={() => setShowNew((v) => !v)} disabled={!mongo}>
            New custom query
          </button>
          <span className="sql-count">{queries.length} queries</span>
        </div>
        {showNew && (
          <form className="sql-new" onSubmit={createNew}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="name (saved as custom/name.sql)"
              required
            />
            <button type="submit">Create</button>
            <button type="button" className="secondary" onClick={() => setShowNew(false)}>Cancel</button>
          </form>
        )}
        <div className="sql-layout">
          <div className="sql-files">
            <h4>Queries</h4>
            <input
              className="sql-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search path…"
            />
            {Object.entries(grouped).map(([dir, dirFiles]) => (
              <div key={dir}>
                <h4>{dir}/</h4>
                {dirFiles.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    className={`sql-file-btn${selectedPath === f.path ? ' active' : ''}${f.dirty ? ' dirty' : ''}`}
                    onClick={() => openQuery(f.path)}
                  >
                    <span>{f.name}</span>
                    {f.dirty ? <span className="sql-edited">edited</span> : null}
                    {f.source === 'custom' ? <span className="sql-edited custom">custom</span> : null}
                  </button>
                ))}
              </div>
            ))}
            {!queries.length && (
              <p className="muted">No queries yet. Click “Add all queries from disk”.</p>
            )}
          </div>
          <div className="sql-editor-panel">
            {selectedPath ? (
              <div className="sql-meta">
                <strong>{selectedPath}</strong>
                {edited ? <span className="sql-edited">unsaved / differs from disk</span> : null}
                {meta?.updatedBy ? (
                  <span className="muted">
                    Last saved by {meta.updatedBy}
                    {meta.updatedAt ? ` · ${new Date(meta.updatedAt).toLocaleString()}` : ''}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="page-hint">Pick a query on the left, or import all from disk first.</p>
            )}
            <textarea
              className="sql-textarea sql-textarea-lg"
              value={sql}
              onChange={(e) => {
                setSql(e.target.value);
                setDirtyLocal(true);
              }}
              spellCheck={false}
              disabled={!mongo && !selectedPath}
            />
            <div className="sql-actions">
              <button type="button" onClick={save} disabled={!mongo || !selectedPath || saving}>
                {saving ? 'Saving…' : 'Save to database'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={revert}
                disabled={!mongo || !selectedPath || meta?.source === 'custom' || saving}
              >
                Revert to disk
              </button>
              {meta?.source === 'custom' && (
                <button type="button" className="secondary" onClick={removeCustom}>
                  Delete
                </button>
              )}
              <button type="button" onClick={run} disabled={loading}>
                {loading ? 'Running…' : '▶ Run'}
              </button>
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
