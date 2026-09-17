'use client'
import { Children, isValidElement, useEffect, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useLanguage } from './language-provider'
import { compareTableValues, pageBounds } from '@/lib/table-utils'
import styles from './platform.module.css'

type Row = Record<string, any>
type Column = { label: string; render: (row: Row) => ReactNode; sortValue?: (row: Row) => string | number | null; sortable?: boolean }
function cellText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (isValidElement<{ children?: ReactNode }>(node)) return cellText(node.props.children)
  return Children.toArray(node).map(cellText).join(' ')
}

export default function DataTable({ rows, columns, empty = 'No records yet.' }: { rows: Row[]; columns: Column[]; empty?: string }) {
  const { t } = useLanguage()
  const [sort, setSort] = useState<{ column: string; direction: 1 | -1 } | null>(null)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(10)
  const rowSet = JSON.stringify(rows.map((row, index) => row.id ?? row.number ?? index))
  useEffect(() => { setPage(1) }, [rowSet])
  const prepared = rows.map((row, index) => ({ row, index, cells: columns.map(column => column.render(row)) }))
  const sortIndex = columns.findIndex(column => column.label === sort?.column)
  if (sort && sortIndex >= 0) {
    const column = columns[sortIndex]
    prepared.sort((a, b) => {
      const value = (entry: typeof a) => column.sortValue ? column.sortValue(entry.row) : cellText(entry.cells[sortIndex])
      return compareTableValues(value(a), value(b)) * sort.direction || a.index - b.index
    })
  }
  const bounds = pageBounds(rows.length, page, size)
  if (!rows.length) return <p className={styles.empty}>{t(empty)}</p>
  return <div><div className={styles.scroll}><table className={styles.table}><thead><tr>{columns.map(column => {
    const sortable = column.sortable ?? !['Action', 'Actions', 'Adjust', 'Changes'].includes(column.label)
    const active = sort?.column === column.label
    return <th key={column.label} aria-sort={sortable ? active ? sort.direction === 1 ? 'ascending' : 'descending' : 'none' : undefined}>{sortable ? <button className={styles.sortButton} onClick={() => { setSort({ column: column.label, direction: active && sort.direction === 1 ? -1 : 1 }); setPage(1) }}>{t(column.label)}{active ? sort.direction === 1 ? <ArrowUp size={13}/> : <ArrowDown size={13}/> : <ArrowUpDown size={13}/>}</button> : t(column.label)}</th>
  })}</tr></thead><tbody>{prepared.slice(bounds.start, bounds.end).map(({ row, index, cells }) => <tr key={row.id || index}>{cells.map((cell, i) => <td key={columns[i].label}>{cell}</td>)}</tr>)}</tbody></table></div><div className={styles.pagination}><p role="status">{bounds.start + 1}–{bounds.end} {t('of', 'kati ya')} {rows.length}</p><label>{t('Rows per page', 'Safu kwa ukurasa')}<select value={size} onChange={event => { setSize(Number(event.target.value)); setPage(1) }}>{[10, 25, 50].map(value => <option key={value}>{value}</option>)}</select></label><button disabled={bounds.page === 1} onClick={() => setPage(bounds.page - 1)}>{t('Previous', 'Uliopita')}</button><span>{bounds.page} / {bounds.pages}</span><button disabled={bounds.page === bounds.pages} onClick={() => setPage(bounds.page + 1)}>{t('Next', 'Unaofuata')}</button></div></div>
}
