/**
 * 储值台账 CSV 导入卡（批次 M1-补2 · R5b · 仅店主 · 日结页底部挂载）
 *
 * 契约（server storedValue.ts，全 merchantOwnerProcedure）：
 * - previewImport({csvText, filename?, mapping})：零写入对账报告——sourceStats
 *   （行数/本金>0 人数/本金合计/赠送合计/唯一手机号/门店分布/次卡夹带/会员编号缺失）
 *   + importPlan（okRows/failRows/失败原因分布/失败样例）；
 * - executeImport：ok 行开户/加账 + 流水，批次落库（reportJson 留痕）；
 *   **只交付不执行——真台账执行等老板令（决策 #32③）**；演示台账试导后批次
 *   可经 clearImportBatch 标记清除（已产生消费的批次拒绝清除）；
 * - mapping = 台账店名 → storeId（本卡 UI：每个台账店名选「映射到本店 / 不导入」，
 *   未映射行在报告中失败留痕——演示台账「未映射店」行即此通道）；
 * - 门店列提取：前端迷你解析（与服务端同规则：BOM/引号转义/引号内逗号）。
 *
 * 红线：本组件不出现任何充值/新售入口（裁定①新售冻结回归保护）。
 */

import { usePhiliaClient } from '@philia/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { FileUp, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { errMsg, fenToYuan } from '@/components/mall-admin/format'
import { IMPORT_BATCHES_KEY, type ImportReport } from './model'
import { CashierModal, SheetBtn } from './dialogs'

/** RFC4180 迷你解析（与服务端 parseCsv 同规则；提取门店列唯一值用） */
function parseCsvGrid(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else field += ch
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** 台账「门店」列唯一值（表头名定位，列序错位容错） */
function extractStoreNames(csvText: string): string[] {
  const grid = parseCsvGrid(csvText)
  if (grid.length < 2) return []
  const idx = grid[0]!.map((h) => h.trim()).indexOf('门店')
  if (idx < 0) return []
  const set = new Set<string>()
  for (const r of grid.slice(1)) {
    const v = (r[idx] ?? '').trim()
    if (v) set.add(v)
  }
  return [...set]
}

export default function ImportLedgerPanel({ storeId }: { storeId: string | undefined }) {
  const { trpc, queryClient } = usePhiliaClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; text: string } | null>(null)
  /** 台账店名 → storeId（空串=不导入）；选择文件后按门店列初始化 */
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [report, setReport] = useState<ImportReport | null>(null)
  const [confirmExecute, setConfirmExecute] = useState(false)
  const [clearTarget, setClearTarget] = useState<string | null>(null)

  const batchesQ = useQuery({
    queryKey: IMPORT_BATCHES_KEY,
    queryFn: () => trpc.storedValue.listImportBatches.query(),
  })

  const previewM = useMutation({
    mutationFn: () =>
      trpc.storedValue.previewImport.mutate({
        csvText: file!.text,
        filename: file!.name,
        mapping: Object.fromEntries(Object.entries(mapping).filter(([, v]) => v !== '')),
      }),
    onSuccess: (r) => {
      setReport(r.report)
      toast.success('对账报告已生成（preview 零写入）')
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const executeM = useMutation({
    mutationFn: () =>
      trpc.storedValue.executeImport.mutate({
        csvText: file!.text,
        filename: file!.name,
        mapping: Object.fromEntries(Object.entries(mapping).filter(([, v]) => v !== '')),
      }),
    onSuccess: (r) => {
      setConfirmExecute(false)
      setReport(r.report)
      toast.success(`已导入批次 ${r.batchId.slice(-6)}：成功 ${r.okRows} 行 / 失败 ${r.failRows} 行（留痕可查）`)
      void queryClient.invalidateQueries({ queryKey: IMPORT_BATCHES_KEY })
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const clearM = useMutation({
    mutationFn: (batchId: string) => trpc.storedValue.clearImportBatch.mutate({ batchId }),
    onSuccess: (r) => {
      setClearTarget(null)
      toast.success(
        r.idempotent
          ? '该批次此前已标记清除'
          : `批次已标记清除：回退流水 ${r.clearedLogs} 条 · 账户 ${r.clearedAccounts} 个（批次行永存留痕）`,
      )
      void queryClient.invalidateQueries({ queryKey: IMPORT_BATCHES_KEY })
    },
    onError: (e) => {
      setClearTarget(null)
      toast.error(errMsg(e))
    },
  })

  const onPickFile = (f: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      setFile({ name: f.name, text })
      setReport(null)
      // 门店列唯一值 → 默认全部映射到本店（可逐店改「不导入」）
      const names = extractStoreNames(text)
      setMapping(Object.fromEntries(names.map((n) => [n, storeId ?? ''])))
    }
    reader.onerror = () => toast.error('文件读取失败')
    reader.readAsText(f, 'utf-8')
  }

  const mappingReady = Object.values(mapping).some((v) => v !== '')

  return (
    <div className="u3-panel" data-testid="sv-import-panel">
      <div className="u3-panel-head">
        <h3>储值台账导入（R5b · 仅店主）</h3>
        <span className="aside">只交付不执行——真台账导入等老板令；演示台账试导可标记清除</span>
      </div>
      <div className="px-[17px] pb-4">
        {/* 文件选择 + mapping */}
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            data-testid="sv-import-file"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onPickFile(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            data-testid="sv-import-pick"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFDF6] px-4 py-2 text-caption font-semibold text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            <FileUp size={13} strokeWidth={1.8} aria-hidden />
            {file ? `已选：${file.name}` : '选择台账 CSV'}
          </button>
          {file ? (
            <span className="text-caption-xs text-[rgba(74,59,46,.42)]">
              {Math.round(file.text.length / 1024)} KB · 门店列 {Object.keys(mapping).length} 个店名
            </span>
          ) : null}
        </div>

        {file && Object.keys(mapping).length > 0 ? (
          <div className="mt-3 rounded-[14px] bg-[#F6F1E3] px-3.5 py-3" data-testid="sv-import-mapping">
            <div className="mb-1.5 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">
              门店映射（台账店名 → 系统门店；未映射行将失败留痕）
            </div>
            {Object.keys(mapping).map((name) => (
              <div key={name} className="flex items-center justify-between py-1 text-caption">
                <span>{name}</span>
                <select
                  data-testid={`sv-import-map-${name}`}
                  value={mapping[name] ?? ''}
                  onChange={(e) => setMapping({ ...mapping, [name]: e.target.value })}
                  className="rounded-[8px] bg-[#FFFDF6] px-2.5 py-1.5 text-caption text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)] focus:outline-none"
                >
                  <option value={storeId ?? ''}>映射到本店（菲丽亚宠物·示例店）</option>
                  <option value="">不导入（失败留痕）</option>
                </select>
              </div>
            ))}
          </div>
        ) : null}

        {file ? (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              data-testid="sv-import-preview"
              disabled={!mappingReady || previewM.isPending}
              onClick={() => previewM.mutate()}
              className="rounded-full bg-[#4A3B2E] px-4 py-2 text-caption font-semibold text-[#F6F1E3] transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
            >
              {previewM.isPending ? '对账中…' : '生成对账报告（零写入）'}
            </button>
            <button
              type="button"
              data-testid="sv-import-execute"
              disabled={!report || executeM.isPending}
              title={report ? '执行导入（写入账户+流水，批次留痕）' : '请先生成对账报告'}
              onClick={() => setConfirmExecute(true)}
              className="rounded-full bg-brand-primary px-4 py-2 text-caption font-bold text-ink shadow-hairline transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
            >
              执行导入
            </button>
          </div>
        ) : null}

        {/* 对账报告（preview/execute 同构） */}
        {report ? (
          <div className="mt-3 rounded-[14px] bg-[#F6F1E3] px-3.5 py-3" data-testid="sv-import-report">
            <div className="mb-1.5 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">对账报告（源文件校验位）</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption-xs text-[rgba(74,59,46,.62)] sm:grid-cols-3">
              <span>数据行数 <b className="font-number tabular-nums text-ink">{report.sourceStats.totalRows}</b></span>
              <span>本金&gt;0 人数 <b className="font-number tabular-nums text-ink">{report.sourceStats.personsWithBalance}</b></span>
              <span>本金合计 <b className="font-number tabular-nums text-ink">¥{fenToYuan(report.sourceStats.principalTotalFen)}</b></span>
              <span>赠送合计 <b className="font-number tabular-nums text-ink">¥{fenToYuan(report.sourceStats.bonusTotalFen)}</b></span>
              <span>唯一手机号 <b className="font-number tabular-nums text-ink">{report.sourceStats.uniquePhones}</b></span>
              <span>次卡夹带行 <b className="font-number tabular-nums text-ink">{report.sourceStats.passCarryRows}</b>（预留未导）</span>
              <span>会员编号缺失 <b className="font-number tabular-nums text-ink">{report.sourceStats.memberNoMissing}</b></span>
              <span className="col-span-2">
                门店分布：{Object.entries(report.sourceStats.storeDist).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}
              </span>
            </div>
            <div className="mt-2 border-t border-dashed border-[rgba(74,59,46,.12)] pt-2 text-caption-xs">
              可导 <b className="font-number tabular-nums text-[#1E4D3D]">{report.importPlan.okRows}</b> 行 ·
              失败 <b className={`font-number tabular-nums ${report.importPlan.failRows > 0 ? 'text-danger-deep' : 'text-ink'}`}>{report.importPlan.failRows}</b> 行
              {Object.keys(report.importPlan.failReasons).length > 0 ? (
                <span className="ml-1 text-[rgba(74,59,46,.62)]">
                  （{Object.entries(report.importPlan.failReasons).map(([r, n]) => `${r} ×${n}`).join('；')}）
                </span>
              ) : null}
            </div>
            {report.importPlan.failSamples.length > 0 ? (
              <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.42)]">
                失败样例：{report.importPlan.failSamples.slice(0, 5).map((s) => `行${s.line} ${s.reason}`).join('；')}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* 批次列表（留痕可查） */}
        <div className="mt-4">
          <div className="mb-1.5 text-caption-xs font-semibold text-[rgba(74,59,46,.42)]">导入批次（留痕可查 · 批次行永存）</div>
          {batchesQ.isPending ? (
            <div className="h-9 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.06)]" />
          ) : (batchesQ.data ?? []).length === 0 ? (
            <p className="text-caption-xs text-[rgba(74,59,46,.42)]" data-testid="sv-import-batches-empty">
              暂无导入批次
            </p>
          ) : (
            (batchesQ.data ?? []).map((b) => (
              <div
                key={b.id}
                data-testid={`sv-import-batch-${b.id}`}
                className="flex flex-wrap items-center gap-2 rounded-[10px] bg-[#F6F1E3] px-3 py-2 text-caption-xs text-[rgba(74,59,46,.62)] [&+&]:mt-1.5"
              >
                <b className="font-number tabular-nums text-ink">批次 {b.id.slice(-6)}</b>
                <span>{b.filename ?? '未留文件名'}</span>
                <span>
                  总行 <b className="font-number tabular-nums text-ink">{b.totalRows}</b> · 成功{' '}
                  <b className="font-number tabular-nums text-[#1E4D3D]">{b.okRows}</b> · 失败{' '}
                  <b className="font-number tabular-nums text-ink">{b.failRows}</b>
                </span>
                <span>本金 ¥{fenToYuan(b.principalTotalFen)}</span>
                <span>{b.operatorName ?? '—'}</span>
                {b.status === 'cleared' ? (
                  <span className="u3-st done">已清除</span>
                ) : (
                  <>
                    <span className="u3-st live">已入账</span>
                    <button
                      type="button"
                      data-testid={`sv-import-clear-${b.id}`}
                      title="标记清除（反向冲减账户+删导入流水；已产生消费的批次拒绝）"
                      onClick={() => setClearTarget(b.id)}
                      className="ml-auto inline-flex items-center gap-1 font-bold text-danger transition-transform duration-120 active:scale-[0.92]"
                    >
                      <Trash2 size={12} strokeWidth={2} aria-hidden />
                      标记清除
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 执行确认（写入动作二次确认） */}
      <CashierModal
        open={confirmExecute}
        onClose={() => setConfirmExecute(false)}
        title="执行导入确认"
        testid="sv-import-confirm"
        footer={
          <>
            <SheetBtn onClick={() => setConfirmExecute(false)}>取消</SheetBtn>
            <SheetBtn
              variant="primary"
              data-testid="sv-import-confirm-ok"
              disabled={executeM.isPending}
              onClick={() => executeM.mutate()}
            >
              {executeM.isPending ? '导入中…' : '确认导入（写入）'}
            </SheetBtn>
          </>
        }
      >
        <p className="py-2 text-body-sm leading-relaxed text-ink">
          将对 {report?.importPlan.okRows ?? 0} 行可导记录开户/加账并写流水（批次留痕可查）。
        </p>
        <p className="text-caption leading-relaxed text-[rgba(74,59,46,.62)]">
          真台账（907 人 / ¥671,264.42）执行等老板令；本次为演示台账试导，试导后可用「标记清除」回滚。
          重复 execute 会重复入账（无文件级幂等），请勿重复提交。
        </p>
      </CashierModal>

      {/* 清除确认 */}
      <CashierModal
        open={clearTarget !== null}
        onClose={() => setClearTarget(null)}
        title="标记清除批次"
        testid="sv-import-clear-dialog"
        footer={
          <>
            <SheetBtn onClick={() => setClearTarget(null)}>取消</SheetBtn>
            <SheetBtn
              variant="danger-outline"
              data-testid="sv-import-clear-ok"
              disabled={clearM.isPending}
              onClick={() => clearTarget && clearM.mutate(clearTarget)}
            >
              {clearM.isPending ? '清除中…' : '确认标记清除'}
            </SheetBtn>
          </>
        }
      >
        <p className="py-2 text-body-sm leading-relaxed text-ink">
          将删除该批次写入的流水并按日志反向冲减账户；批次行永存（置「已清除」留痕）。
        </p>
        <p className="text-caption leading-relaxed text-[rgba(74,59,46,.62)]">
          已产生消费的批次拒绝清除（保护真账）——差错请走对账调整留痕。
        </p>
      </CashierModal>
    </div>
  )
}
