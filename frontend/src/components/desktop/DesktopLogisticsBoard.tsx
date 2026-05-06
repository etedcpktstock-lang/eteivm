import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Truck, Clock3, CheckCircle2, ScanSearch, ArrowRightLeft, PackageSearch, UserRound } from 'lucide-react';
import { getLogisticsJobs, searchAssetUnits } from '../../api';
import { formatThaiDateTime } from '../../utils/dateTimeUtils';
import { aggregateJobItems, checkIsActiveJob, checkIsHistoryJob, checkIsWaitingJob, formatItemName } from '../../utils/logisticsUtils';

interface DesktopLogisticsBoardProps {
  items: any[];
  customers: any[];
  operatorName: string;
  onNavigateToTab: (tab: string, jobId: string) => void;
  initialTab?: 'waiting' | 'active' | 'history';
  transactions: any[];
  loading?: boolean;
}

type LogisticsTab = 'waiting' | 'active' | 'history';

const tabLabelMap: Record<LogisticsTab, string> = {
  waiting: 'รอรับงาน',
  active: 'กำลังดำเนินการ',
  history: 'ประวัติงาน',
};

const DesktopLogisticsBoard: React.FC<DesktopLogisticsBoardProps> = ({
  customers,
  operatorName,
  onNavigateToTab,
  initialTab = 'waiting',
  loading: globalLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<LogisticsTab>(initialTab);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [assetQuery, setAssetQuery] = useState('');
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetResults, setAssetResults] = useState<any[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));

  const fetchJobs = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await getLogisticsJobs();
      setJobs(data || []);
      setLastSyncTime(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    } catch (err) {
      console.error('Fetch logistics jobs error:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const filteredJobs = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const base = jobs.filter((job) => {
      if (!search) return true;
      return [job.jobId, job.cv, job.customerName, job.status]
        .map((v) => String(v || '').toLowerCase())
        .some((v) => v.includes(search));
    });

    if (activeTab === 'waiting') return base.filter(checkIsWaitingJob);
    if (activeTab === 'active') return base.filter(checkIsActiveJob);
    return base.filter(checkIsHistoryJob);
  }, [jobs, activeTab, searchTerm]);

  useEffect(() => {
    if (!filteredJobs.length) {
      setSelectedJobId(null);
      return;
    }
    if (!selectedJobId || !filteredJobs.some((job) => job.jobId === selectedJobId)) {
      setSelectedJobId(filteredJobs[0].jobId);
    }
  }, [filteredJobs, selectedJobId]);

  const selectedJob = useMemo(() => filteredJobs.find((job) => job.jobId === selectedJobId) || null, [filteredJobs, selectedJobId]);

  const stats = useMemo(() => ({
    waiting: jobs.filter(checkIsWaitingJob).length,
    active: jobs.filter(checkIsActiveJob).length,
    history: jobs.filter(checkIsHistoryJob).length,
  }), [jobs]);

  const selectedCustomer = useMemo(() => {
    if (!selectedJob) return null;
    return customers.find((customer) => String(customer.cv || customer.CV) === String(selectedJob.cv || selectedJob.CV));
  }, [customers, selectedJob]);

  const selectedJobItems = useMemo(() => {
    if (!selectedJob) return [];
    try {
      const aggregated = aggregateJobItems(selectedJob.items || [], selectedJob.status);
      return aggregated.allAggregated || [];
    } catch {
      return [];
    }
  }, [selectedJob]);

  const handleAssetLookup = async () => {
    const q = assetQuery.trim();
    if (!q) {
      setAssetResults([]);
      setAssetError('กรอก S/N หรือ Asset Tag ก่อนค้นหา');
      return;
    }
    setAssetLoading(true);
    setAssetError(null);
    try {
      const results = await searchAssetUnits({ q, limit: 20 });
      setAssetResults(results || []);
      if (!results || results.length === 0) setAssetError('ไม่พบข้อมูลรหัสเครื่องนี้');
    } catch (err: any) {
      setAssetResults([]);
      setAssetError(err?.message || 'ค้นหาไม่สำเร็จ');
    } finally {
      setAssetLoading(false);
    }
  };

  const mapAssetStatusLabel = (s: string) => {
    const status = String(s || '').toLowerCase();
    if (status === 'stock') return 'สต็อก';
    if (status === 'quarantine') return 'รอตรวจ';
    if (status === 'repair') return 'รอซ่อม';
    if (status === 'in_transit') return 'ระหว่างทาง';
    if (status === 'with_customer') return 'อยู่กับลูกค้า';
    if (status === 'scrap') return 'ซาก';
    if (status === 'lost') return 'สูญหาย';
    return s || '-';
  };

  return (
    <div className="desktop-page">
      <div className="desktop-page-header">
        <div className="desktop-page-header-main">
          <h2 className="plain-page-title">งานขนส่ง</h2>
          <p className="plain-subtitle">Desktop control board สำหรับคุมงานรอรับ, งานกำลังดำเนินการ, ประวัติงาน และตรวจ S/N / Asset Tag จากหน้าจอเดียว</p>
        </div>
      </div>

      <div className="desktop-stat-grid">
        <div className="plain-kpi"><div className="plain-kpi-label">รอรับงาน</div><div className="plain-kpi-value">{stats.waiting.toLocaleString()}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">กำลังดำเนินการ</div><div className="plain-kpi-value">{stats.active.toLocaleString()}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">ประวัติงาน</div><div className="plain-kpi-value">{stats.history.toLocaleString()}</div></div>
        <div className="plain-kpi"><div className="plain-kpi-label">sync ล่าสุด</div><div className="plain-kpi-value" style={{ fontSize: 18 }}>{lastSyncTime}</div></div>
      </div>

      <div className="plain-card">
        <div className="plain-card-header">
          <div className="desktop-toolbar">
            <div className="desktop-toolbar-grow" style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#9ca3af' }} />
              <input className="plain-search" style={{ width: '100%' }} placeholder="ค้นหา Job ID / CV / ลูกค้า / สถานะ" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button className="plain-logout" style={{ width: 125, background: activeTab === 'waiting' ? '#0f172a' : undefined, color: activeTab === 'waiting' ? '#fff' : undefined, borderColor: activeTab === 'waiting' ? '#0f172a' : undefined }} onClick={() => setActiveTab('waiting')}>รอรับงาน</button>
            <button className="plain-logout" style={{ width: 150, background: activeTab === 'active' ? '#0f172a' : undefined, color: activeTab === 'active' ? '#fff' : undefined, borderColor: activeTab === 'active' ? '#0f172a' : undefined }} onClick={() => setActiveTab('active')}>กำลังดำเนินการ</button>
            <button className="plain-logout" style={{ width: 120, background: activeTab === 'history' ? '#0f172a' : undefined, color: activeTab === 'history' ? '#fff' : undefined, borderColor: activeTab === 'history' ? '#0f172a' : undefined }} onClick={() => setActiveTab('history')}>ประวัติงาน</button>
            <button className="plain-logout" style={{ width: 40 }} onClick={() => fetchJobs(true)} disabled={loading || globalLoading}><RefreshCw size={14} /></button>
          </div>
        </div>
      </div>

      <div className="desktop-split-grid desktop-split-grid--logistics-detail-wide">
        <div className="plain-card">
          <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={15} /> {tabLabelMap[activeTab]} ({filteredJobs.length})
          </div>
          <div className="desktop-scroll desktop-scroll--tall">
            {filteredJobs.map((job) => {
              const active = selectedJobId === job.jobId;
              return (
                <button
                  key={job.jobId}
                  onClick={() => setSelectedJobId(job.jobId)}
                  style={{ width: '100%', textAlign: 'left', padding: 12, border: 'none', borderBottom: '1px solid #f1f5f9', background: active ? '#ecfdf5' : '#fff' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 700 }}>#{job.jobId || '-'}</div>
                    <span className="plain-badge">{job.status || '-'}</span>
                  </div>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>{job.customerName || job.cv || '-'}</div>
                  <div className="plain-subtitle" style={{ marginTop: 4 }}>{job.cv || '-'} • {formatThaiDateTime(job.updated_at || job.completion_date || job.deliveryDate || job.created_at)}</div>
                  <div className="plain-subtitle" style={{ marginTop: 4 }}>จำนวนรายการ {Array.isArray(job.items) ? job.items.length : 0}</div>
                </button>
              );
            })}
            {filteredJobs.length === 0 && <div className="desktop-empty">ไม่พบงานตามตัวกรอง</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div className="plain-card">
            {!selectedJob && <div className="desktop-empty">เลือกรายการงานจากฝั่งซ้ายเพื่อดูรายละเอียด</div>}
            {selectedJob && (
              <div className="desktop-page" style={{ gap: 0 }}>
                <div className="plain-card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>#{selectedJob.jobId || '-'}</div>
                    <div className="plain-subtitle">{selectedJob.customerName || selectedJob.cv || '-'} • ผู้ดูแลงาน {operatorName}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button className="plain-logout" style={{ width: 120 }} onClick={() => onNavigateToTab('issue', selectedJob.jobId)}>
                      <ArrowRightLeft size={14} style={{ marginRight: 6 }} /> ไปหน้าเบิก
                    </button>
                    <button className="plain-logout" style={{ width: 130 }} onClick={() => onNavigateToTab('return', selectedJob.jobId)}>
                      <PackageSearch size={14} style={{ marginRight: 6 }} /> ไปหน้ารับคืน
                    </button>
                  </div>
                </div>

                <div className="desktop-panel-body" style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                    <div className="plain-kpi" style={{ padding: 10 }}><div className="plain-kpi-label">สถานะ</div><div style={{ fontWeight: 700 }}>{selectedJob.status || '-'}</div></div>
                    <div className="plain-kpi" style={{ padding: 10 }}><div className="plain-kpi-label">ลูกค้า / CV</div><div style={{ fontWeight: 700 }}>{selectedJob.customerName || '-'}</div><div className="plain-subtitle">{selectedJob.cv || '-'}</div></div>
                    <div className="plain-kpi" style={{ padding: 10 }}><div className="plain-kpi-label">รายการย่อย</div><div style={{ fontWeight: 700 }}>{selectedJobItems.length.toLocaleString()}</div></div>
                  </div>

                  <div className="plain-card" style={{ marginTop: 0 }}>
                    <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><UserRound size={15} /> ข้อมูลงาน / ลูกค้า</div>
                    <div className="desktop-panel-body" style={{ display: 'grid', gap: 6 }}>
                      <div><strong>ชื่อลูกค้า:</strong> {selectedCustomer?.name || selectedJob.customerName || '-'}</div>
                      <div><strong>CV:</strong> {selectedJob.cv || '-'}</div>
                      <div><strong>เบอร์โทร:</strong> {selectedCustomer?.phone || '-'}</div>
                      <div><strong>ที่อยู่:</strong> {[selectedCustomer?.address, selectedCustomer?.subdistrict, selectedCustomer?.district, selectedCustomer?.province, selectedCustomer?.zipcode].filter(Boolean).join(' ') || '-'}</div>
                    </div>
                  </div>

                  <div className="plain-card" style={{ marginTop: 0 }}>
                    <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Clock3 size={15} /> รายการงานใน Job</div>
                    <div className="desktop-scroll">
                      <table className="plain-table">
                        <thead>
                          <tr>
                            <th>รายการ</th>
                            <th>หมวด</th>
                            <th>แผน</th>
                            <th>ทำแล้ว</th>
                            <th>สถานะล่าสุด</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedJobItems.map((agg: any, idx: number) => {
                            const named = formatItemName(agg.it || {});
                            return (
                              <tr key={`${selectedJob.jobId}-${idx}`}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{named.main || agg.it?.รายการ || '-'}</div>
                                  <div className="plain-subtitle">{named.meta || '-'}</div>
                                </td>
                                <td>{agg.category || '-'}</td>
                                <td>{Number(agg.plan || 0).toLocaleString()}</td>
                                <td>{Number(agg.action || 0).toLocaleString()}</td>
                                <td>{agg.action_type || '-'}</td>
                              </tr>
                            );
                          })}
                          {selectedJobItems.length === 0 && (
                            <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>ไม่พบรายการย่อยในงานนี้</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="plain-card">
            <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ScanSearch size={15} /> ตรวจ S/N / Asset Tag</div>
            <div className="desktop-panel-body" style={{ display: 'grid', gap: 10 }}>
              <div className="desktop-toolbar">
                <div className="desktop-toolbar-grow" style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#9ca3af' }} />
                  <input className="plain-search" style={{ width: '100%' }} placeholder="ค้นหา S/N หรือ Asset Tag" value={assetQuery} onChange={(e) => setAssetQuery(e.target.value)} />
                </div>
                <button className="plain-logout" style={{ width: 90 }} onClick={handleAssetLookup} disabled={assetLoading}>{assetLoading ? 'ค้นหา...' : 'ค้นหา'}</button>
              </div>
              {assetError && <div className="plain-subtitle" style={{ color: '#dc2626' }}>{assetError}</div>}
              <div style={{ display: 'grid', gap: 8 }}>
                {assetResults.map((u: any) => (
                  <div key={u.id || u.assetTag} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontWeight: 700 }}>{u.assetTag || '-'}</div>
                      <span className="plain-badge">{mapAssetStatusLabel(u.status)}</span>
                    </div>
                    <div className="plain-subtitle" style={{ marginTop: 4 }}>S/N: {u.serialNumber || u.serial_number || '-'} • คลัง: {u.warehouse?.name || '-'}</div>
                    <div className="plain-subtitle">ลูกค้า/CV: {u.customer?.name || u.customer?.cv || '-'}</div>
                  </div>
                ))}
                {assetResults.length === 0 && !assetError && <div className="plain-subtitle">ใช้ส่วนนี้เพื่อตรวจสถานะเครื่องแบบ serialized ได้เร็วบน desktop</div>}
              </div>
            </div>
          </div>

          <p className="plain-subtitle">บอร์ดนี้เน้น control / review / trace บน desktop ส่วน flow ปฏิบัติการเชิงลึกยัง reuse หน้าเบิกและรับคืนเดิมแบบ safe-first</p>
        </div>
      </div>
    </div>
  );
};

export default DesktopLogisticsBoard;
