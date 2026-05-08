import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, FileSpreadsheet, FileText, History, PackageSearch, Boxes, ScanSearch, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import { exportJsonToExcel } from '../../utils/excel';
import autoTable from 'jspdf-autotable';
import { calculateCustomerInventory } from '../../utils/logisticsUtils';

interface DesktopInventoryProps {
  items: any[];
  warehouses?: any[];
  transactions?: any[];
  customers?: any[];
  onRefresh?: () => void;
  loading?: boolean;
  onNavigate?: (tabId: string) => void;
}

const normalizeText = (value: any) => String(value || '').trim().toLowerCase();

const getItemKey = (item: any) => String(item?.id || item?.rowIndex || item?.item_id || item?.รายการ || '');

const getWarehouseLabel = (warehouse: any) => warehouse?.name || warehouse?.ศูนย์ || `คลัง ${warehouse?.id || '-'}`;

const getWarehouseStockValues = (stock: any) => ({
  stock_qty: Number(stock?.stock_qty ?? stock?.stock ?? 0),
  transit_qty: Number(stock?.transit_qty ?? stock?.transit ?? 0),
  quarantine_qty: Number(stock?.quarantine_qty ?? stock?.quarantine ?? 0),
  repair_qty: Number(stock?.repair_qty ?? stock?.repair ?? 0),
  scrap_qty: Number(stock?.scrap_qty ?? stock?.scrap ?? 0),
  lost_qty: Number(stock?.lost_qty ?? stock?.lost ?? 0),
});

const DesktopInventory: React.FC<DesktopInventoryProps> = ({
  items,
  warehouses = [],
  transactions = [],
  customers = [],
  onRefresh,
  loading,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ทั้งหมด');
  const [filterBrand, setFilterBrand] = useState('ทั้งหมด');
  const [filterCondition, setFilterCondition] = useState('ทั้งหมด');
  const [filterWarehouse, setFilterWarehouse] = useState('ทั้งหมด');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const transactionMetaMap = useMemo(() => {
    const map = new Map<string, { text: string; txns: any[]; identifiers: string[] }>();

    items.forEach((item) => {
      const itemKey = getItemKey(item);
      const relatedTxns = transactions.filter((txn) => {
        const txnItemId = txn.item_id || txn.rowIndex || txn.rowIndexMaster;
        if (txnItemId && (String(txnItemId) === String(item.id) || String(txnItemId) === String(item.rowIndex))) return true;

        const itemName = normalizeText(item.รายการ);
        const txnName = normalizeText(txn.รายการ || txn.item_name);
        const itemBrand = normalizeText(item.ยี่ห้อหรือรูปแบบ);
        const txnBrand = normalizeText(txn['ยี่ห้อหรือรูปแบบ'] || txn['ยี่ห้อ/รูปแบบ'] || txn.brand);
        const itemType = normalizeText(item.ประเภท);
        const txnType = normalizeText(txn.ประเภท || txn.category);

        return itemName && itemName === txnName && (!itemBrand || itemBrand === txnBrand) && (!itemType || itemType === txnType);
      });

      const identifiers = Array.from(
        new Set(
          relatedTxns.flatMap((txn) => {
            const values = [txn.serial_number, txn.serialNumber, txn.asset_tag, txn.assetTag];
            return values.map((v) => String(v || '').trim()).filter(Boolean);
          })
        )
      );

      const text = [
        item.รายการ,
        item.รายละเอียด,
        item.ยี่ห้อหรือรูปแบบ,
        item.ประเภท,
        item.tracking_type,
        ...identifiers,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      map.set(itemKey, { text, txns: relatedTxns, identifiers });
    });

    return map;
  }, [items, transactions]);

  const types = useMemo(() => ['ทั้งหมด', ...Array.from(new Set(items.map((i) => i.ประเภท).filter(Boolean))).sort()], [items]);
  const brands = useMemo(() => ['ทั้งหมด', ...Array.from(new Set(items.map((i) => i.ยี่ห้อหรือรูปแบบ).filter(Boolean))).sort()], [items]);
  const conditions = useMemo(() => ['ทั้งหมด', ...Array.from(new Set(items.map((i) => i.สภาพ).filter(Boolean))).sort()], [items]);

  const filteredItems = useMemo(() => {
    const q = normalizeText(searchTerm);
    const targetWhId = filterWarehouse !== 'ทั้งหมด' ? warehouses.find((w) => String(w.name || w.ศูนย์) === filterWarehouse)?.id : null;

    return items
      .map((item) => {
        const itemKey = getItemKey(item);
        const baseStocks = Array.isArray(item.warehouse_stocks) ? item.warehouse_stocks : [];
        const selectedStock = targetWhId ? baseStocks.find((s: any) => Number(s.warehouse_id ?? s.warehouseId) === Number(targetWhId)) : null;
        const stockValues = selectedStock
          ? getWarehouseStockValues(selectedStock)
          : {
              stock_qty: Number(item.จำนวน || 0),
              transit_qty: Number(item.transit_qty || 0),
              quarantine_qty: Number(item.quarantine_qty || 0),
              repair_qty: Number(item.repair_qty || 0),
              scrap_qty: Number(item.scrap_qty || 0),
              lost_qty: Number(item.lost_qty || 0),
            };

        const meta = transactionMetaMap.get(itemKey);

        return {
          ...item,
          __key: itemKey,
          __txns: meta?.txns || [],
          __identifiers: meta?.identifiers || [],
          __searchText: meta?.text || '',
          จำนวน: stockValues.stock_qty,
          transit_qty: stockValues.transit_qty,
          quarantine_qty: stockValues.quarantine_qty,
          repair_qty: stockValues.repair_qty,
          scrap_qty: stockValues.scrap_qty,
          lost_qty: stockValues.lost_qty,
        };
      })
      .filter((item) => {
        const matchSearch =
          !q ||
          normalizeText(item.รายการ).includes(q) ||
          normalizeText(item.รายละเอียด).includes(q) ||
          normalizeText(item.ยี่ห้อหรือรูปแบบ).includes(q) ||
          normalizeText(item.ประเภท).includes(q) ||
          normalizeText(item.tracking_type).includes(q) ||
          item.__searchText.includes(q);

        const matchType = filterType === 'ทั้งหมด' || item.ประเภท === filterType;
        const matchBrand = filterBrand === 'ทั้งหมด' || item.ยี่ห้อหรือรูปแบบ === filterBrand;
        const matchCond = filterCondition === 'ทั้งหมด' || item.สภาพ === filterCondition;

        return matchSearch && matchType && matchBrand && matchCond;
      });
  }, [items, warehouses, transactions, customers, filterWarehouse, searchTerm, filterType, filterBrand, filterCondition, transactionMetaMap]);

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedKey(null);
      return;
    }

    const exists = filteredItems.some((item) => item.__key === selectedKey);
    if (!exists) setSelectedKey(filteredItems[0].__key);
  }, [filteredItems, selectedKey]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.__key === selectedKey) || null,
    [filteredItems, selectedKey]
  );

  const selectedItemWarehouseRows = useMemo(() => {
    if (!selectedItem) return [];

    const baseStocks = Array.isArray(selectedItem.warehouse_stocks) ? selectedItem.warehouse_stocks : [];
    if (baseStocks.length > 0) {
      return baseStocks.map((stock: any) => {
        const warehouseId = Number(stock?.warehouse_id ?? stock?.warehouseId ?? 0);
        const warehouse = warehouses.find((w) => Number(w.id) === warehouseId);
        return {
          warehouseId,
          warehouseName: warehouse ? getWarehouseLabel(warehouse) : `คลัง ${warehouseId || '-'}`,
          ...getWarehouseStockValues(stock),
        };
      });
    }

    return [
      {
        warehouseId: 0,
        warehouseName: 'รวมทุกคลัง',
        stock_qty: Number(selectedItem.จำนวน || 0),
        transit_qty: Number(selectedItem.transit_qty || 0),
        quarantine_qty: Number(selectedItem.quarantine_qty || 0),
        repair_qty: Number(selectedItem.repair_qty || 0),
        scrap_qty: Number(selectedItem.scrap_qty || 0),
        lost_qty: Number(selectedItem.lost_qty || 0),
      },
    ];
  }, [selectedItem, warehouses]);

  const selectedItemRecentTxns = useMemo(() => {
    if (!selectedItem) return [];
    return [...(selectedItem.__txns || [])]
      .sort((a, b) => new Date(b['วัน-เวลา'] || b.created_at || 0).getTime() - new Date(a['วัน-เวลา'] || a.created_at || 0).getTime())
      .slice(0, 8);
  }, [selectedItem]);

  const selectedItemIdentifiers = useMemo(() => {
    if (!selectedItem) return [];
    return (selectedItem.__identifiers || []).slice(0, 20);
  }, [selectedItem]);

  const selectedItemCustomerPossession = useMemo(() => {
    if (!selectedItem) return [];

    const matched = customers
      .map((customer) => {
        const inventory = Array.isArray(customer.inventory)
          ? customer.inventory
          : calculateCustomerInventory(transactions, customer.cv || customer.CV, [], items);

        const hit = (inventory || []).find((inv: any) => {
          const invName = normalizeText(inv.name || inv.รายการ || inv.item_name);
          const invMeta = normalizeText(inv.meta || inv.ยี่ห้อหรือรูปแบบ || inv.brand);
          const invType = normalizeText(inv.type || inv.ประเภท);
          const itemName = normalizeText(selectedItem.รายการ);
          const itemMeta = normalizeText(selectedItem.ยี่ห้อหรือรูปแบบ);
          const itemType = normalizeText(selectedItem.ประเภท);
          return invName === itemName && (!itemMeta || invMeta.includes(itemMeta) || itemMeta.includes(invMeta)) && (!itemType || invType === itemType);
        });

        if (!hit || Number(hit.qty || 0) <= 0) return null;

        return {
          cv: customer.cv || customer.CV,
          name: customer.name || customer.shop_name || '-',
          qty: Number(hit.qty || 0),
          lastStatus: hit.lastStatus || '-',
          lastDate: hit.lastDate || '-',
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.qty - a.qty)
      .slice(0, 8);

    return matched;
  }, [selectedItem, customers, transactions, items]);

  const resetFilters = () => {
    setSearchTerm('');
    setFilterType('ทั้งหมด');
    setFilterBrand('ทั้งหมด');
    setFilterCondition('ทั้งหมด');
    setFilterWarehouse('ทั้งหมด');
  };

  const exportToExcel = async () => {
    const data = filteredItems.map((item, idx) => ({
      ลำดับ: idx + 1,
      ประเภท: item.ประเภท,
      'ยี่ห้อ/รูปแบบ': item.ยี่ห้อหรือรูปแบบ,
      รายการพัสดุ: item.รายการ,
      สภาพ: item.สภาพ,
      Tracking: item.tracking_type || '-',
      จำนวนคงเหลือ: item.จำนวน,
      ระหว่างส่ง: item.transit_qty || 0,
      รอตรวจ: item.quarantine_qty || 0,
      รอซ่อม: item.repair_qty || 0,
      'ซาก/หาย': Number(item.scrap_qty || 0) + Number(item.lost_qty || 0),
      'S/N / Asset Tags': (item.__identifiers || []).join(', '),
    }));

    await exportJsonToExcel(data, 'Inventory', `Inventory_${Date.now()}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFont('Sarabun');
    doc.text('รายงานสต็อกพัสดุ', 14, 15);

    const tableData = filteredItems.map((item, idx) => [
      idx + 1,
      item.ประเภท || '-',
      item.ยี่ห้อหรือรูปแบบ || '-',
      item.รายการ || '-',
      item.tracking_type || '-',
      Number(item.จำนวน || 0),
      Number(item.transit_qty || 0),
      Number(item.quarantine_qty || 0),
      Number(item.repair_qty || 0),
      Number(item.scrap_qty || 0) + Number(item.lost_qty || 0),
    ]);

    autoTable(doc, {
      startY: 20,
      head: [['#', 'ประเภท', 'ยี่ห้อ', 'รายการ', 'Tracking', 'พร้อมใช้', 'ระหว่างส่ง', 'รอตรวจ', 'ซ่อม', 'ซาก/หาย']],
      body: tableData,
      theme: 'grid',
      styles: { font: 'Sarabun', fontSize: 8 },
    });

    doc.save(`Inventory_${Date.now()}.pdf`);
  };

  return (
    <div className="desktop-page">
      <div className="desktop-page-header">
        <div className="desktop-page-header-main">
          <h2 className="plain-page-title">สต็อกพัสดุ</h2>
          <p className="plain-subtitle">Workspace สำหรับค้นสต็อก, ดู stock ต่อคลัง, trace movement และเช็ก S/N / Asset Tag จากหน้าจอเดียว</p>
        </div>
      </div>

      <div className="plain-card">
        <div className="plain-card-header">
          <div className="desktop-toolbar">
            <div className="desktop-toolbar-grow" style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: '#9ca3af' }} />
              <input
                className="plain-search"
                style={{ width: '100%' }}
                placeholder="ค้นหา: รายการ / ประเภท / ยี่ห้อ / S/N / Asset Tag"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select className="plain-logout" style={{ width: 150 }} value={filterWarehouse} onChange={(e) => setFilterWarehouse(e.target.value)}>
              <option value="ทั้งหมด">ทุกคลัง</option>
              {warehouses.map((w) => <option key={w.id} value={w.name || w.ศูนย์}>{w.name || w.ศูนย์}</option>)}
            </select>
            <select className="plain-logout" style={{ width: 140 }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="plain-logout" style={{ width: 140 }} value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select className="plain-logout" style={{ width: 140 }} value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)}>
              {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <button className="plain-logout" style={{ width: 72 }} onClick={resetFilters}>ล้าง</button>
            <button className="plain-logout" style={{ width: 40 }} onClick={exportToExcel}><FileSpreadsheet size={14} /></button>
            <button className="plain-logout" style={{ width: 40 }} onClick={exportToPDF}><FileText size={14} /></button>
            <button className="plain-logout" style={{ width: 40 }} onClick={onRefresh} disabled={loading}><RefreshCw size={14} /></button>
            {onNavigate && <button className="plain-logout" style={{ width: 92 }} onClick={() => onNavigate('transfer')}>ย้ายพัสดุ</button>}
          </div>
        </div>
      </div>

      <div className="desktop-split-grid desktop-split-grid--wide-right">
        <div className="plain-card">
          <div className="plain-card-header">รายการสต็อก ({filteredItems.length})</div>
          <div className="desktop-scroll">
            <table className="plain-table">
              <thead>
                <tr>
                  <th>พัสดุ</th>
                  <th>Tracking</th>
                  <th>พร้อมใช้</th>
                  <th>ระหว่างส่ง</th>
                  <th>รอตรวจ</th>
                  <th>รอซ่อม</th>
                  <th>ซาก/หาย</th>
                  <th>รวม</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const total =
                    (Number(item.จำนวน) || 0) +
                    (Number(item.transit_qty) || 0) +
                    (Number(item.quarantine_qty) || 0) +
                    (Number(item.repair_qty) || 0) +
                    (Number(item.scrap_qty) || 0) +
                    (Number(item.lost_qty) || 0);
                  const active = selectedKey === item.__key;

                  return (
                    <tr
                      key={`${item.id}-${idx}`}
                      onClick={() => setSelectedKey(item.__key)}
                      style={{ background: active ? '#ecfdf5' : '#fff', cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.รายการ}</div>
                        <div style={{ color: '#6b7280', fontSize: 11 }}>
                          {item.ประเภท} • {item.ยี่ห้อหรือรูปแบบ || '-'} {item.ขนาด ? `• ขนาด: ${item.ขนาด}` : ''}
                        </div>
                        <div style={{ color: '#6b7280', fontSize: 10, marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span className="plain-badge" style={{ padding: '0 4px', fontSize: 9 }}>สภาพ: {item.สภาพ || 'ใหม่'}</span>
                          <span className="plain-badge" style={{ padding: '0 4px', fontSize: 9, background: '#f3f4f6', color: '#4b5563', border: 'none' }}>
                            คลัง: {filterWarehouse !== 'ทั้งหมด' ? filterWarehouse : (
                              (item.warehouse_stocks || [])
                                .filter((s: any) => Number(s.stock_qty ?? s.stock ?? 0) > 0 || Number(s.quarantine_qty ?? s.quarantine ?? 0) > 0 || Number(s.repair_qty ?? s.repair ?? 0) > 0)
                                .map((s: any) => {
                                  const wId = Number(s.warehouse_id ?? s.warehouseId);
                                  const w = warehouses.find((w: any) => Number(w.id) === wId);
                                  return w ? (w.name || w.ศูนย์) : `คลัง ${wId}`;
                                }).join(', ') || 'ไม่มีสต็อก'
                            )}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="plain-badge">{item.tracking_type || 'BATCH'}</span>
                      </td>
                      <td>{Number(item.จำนวน || 0).toLocaleString()}</td>
                      <td>{Number(item.transit_qty || 0).toLocaleString()}</td>
                      <td>{Number(item.quarantine_qty || 0).toLocaleString()}</td>
                      <td>{Number(item.repair_qty || 0).toLocaleString()}</td>
                      <td>{(Number(item.scrap_qty || 0) + Number(item.lost_qty || 0)).toLocaleString()}</td>
                      <td style={{ fontWeight: 700 }}>{total.toLocaleString()}</td>
                    </tr>
                  );
                })}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: '#6b7280' }}>ไม่พบข้อมูลพัสดุ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="plain-card">
          {!selectedItem && <div className="desktop-empty">เลือกรายการจากฝั่งซ้ายเพื่อดูรายละเอียด</div>}

          {selectedItem && (
            <div className="desktop-page" style={{ gap: 0 }}>
              <div className="plain-card-header">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedItem.รายการ}</div>
                    <div className="plain-subtitle">{selectedItem.ประเภท} • {selectedItem.ยี่ห้อหรือรูปแบบ || '-'} {selectedItem.ขนาด ? `• ${selectedItem.ขนาด}` : ''}</div>
                  </div>
                  <span className="plain-badge">{selectedItem.tracking_type || 'BATCH'}</span>
                </div>
              </div>

              <div className="desktop-panel-body" style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  <div className="plain-kpi" style={{ padding: 10 }}>
                    <div className="plain-kpi-label">พร้อมใช้</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{Number(selectedItem.จำนวน || 0).toLocaleString()}</div>
                  </div>
                  <div className="plain-kpi" style={{ padding: 10 }}>
                    <div className="plain-kpi-label">ระหว่างส่ง</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{Number(selectedItem.transit_qty || 0).toLocaleString()}</div>
                  </div>
                  <div className="plain-kpi" style={{ padding: 10 }}>
                    <div className="plain-kpi-label">รอตรวจ/ซ่อม</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{(Number(selectedItem.quarantine_qty || 0) + Number(selectedItem.repair_qty || 0)).toLocaleString()}</div>
                  </div>
                </div>

                <div className="plain-card" style={{ marginTop: 0 }}>
                  <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Boxes size={15} /> stock ตามคลัง
                  </div>
                  <div className="desktop-scroll">
                    <table className="plain-table">
                      <thead>
                        <tr>
                          <th>คลัง</th>
                          <th>พร้อมใช้</th>
                          <th>Transit</th>
                          <th>Quarantine</th>
                          <th>Repair</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItemWarehouseRows.map((row) => (
                          <tr key={`${selectedItem.__key}-${row.warehouseId}`}>
                            <td>{row.warehouseName}</td>
                            <td>{row.stock_qty.toLocaleString()}</td>
                            <td>{row.transit_qty.toLocaleString()}</td>
                            <td>{row.quarantine_qty.toLocaleString()}</td>
                            <td>{row.repair_qty.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="plain-card" style={{ marginTop: 0 }}>
                  <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ScanSearch size={15} /> S/N / Asset Tag ล่าสุด
                  </div>
                  <div className="desktop-panel-body">
                    {selectedItemIdentifiers.length === 0 ? (
                      <div className="plain-subtitle">ยังไม่พบ S/N หรือ Asset Tag ที่โยงกับรายการนี้จาก transaction history</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {selectedItemIdentifiers.map((identifier) => (
                          <span key={identifier} className="plain-badge">{identifier}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="plain-card" style={{ marginTop: 0 }}>
                  <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={15} /> ครอบครองโดยลูกค้า
                  </div>
                  <div className="desktop-panel-body">
                    {selectedItemCustomerPossession.length === 0 ? (
                      <div className="plain-subtitle">ยังไม่พบข้อมูลครอบครองของลูกค้าสำหรับรายการนี้</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {selectedItemCustomerPossession.map((row: any) => (
                          <div key={`${row.cv}-${row.name}`} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10, background: '#fff' }}>
                            <div style={{ fontWeight: 600 }}>{row.name}</div>
                            <div className="plain-subtitle">CV: {row.cv || '-'} • จำนวน {Number(row.qty || 0).toLocaleString()}</div>
                            <div className="plain-subtitle">สถานะล่าสุด: {row.lastStatus || '-'}{row.lastDate ? ` • ${row.lastDate}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="plain-card" style={{ marginTop: 0 }}>
                  <div className="plain-card-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <History size={15} /> movement ล่าสุด
                  </div>
                  <div className="desktop-scroll">
                    <table className="plain-table">
                      <thead>
                        <tr>
                          <th>เวลา</th>
                          <th>สถานะ</th>
                          <th>ลูกค้า/CV</th>
                          <th>จำนวน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItemRecentTxns.map((txn: any, idx: number) => (
                          <tr key={`${txn.id || txn.เลขที่รายการ || idx}-${idx}`}>
                            <td>{txn['วัน-เวลา'] || '-'}</td>
                            <td>{txn.สถานะ || txn.action_type || '-'}</td>
                            <td>{txn.CV || txn.cv || txn.เขตการทำงาน || '-'}</td>
                            <td>{Math.abs(Number(txn.จำนวน || txn.quantity || 0)).toLocaleString()}</td>
                          </tr>
                        ))}
                        {selectedItemRecentTxns.length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', color: '#6b7280' }}>ยังไม่พบ movement history</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="plain-subtitle">
        แสดงผล {filteredItems.length} จากทั้งหมด {items.length} รายการ
        {filterWarehouse !== 'ทั้งหมด' ? ' • รวมรายการที่คงเหลือ 0 เพื่อให้ตรวจสต็อกต่อคลังได้ครบ' : ''}
      </p>
    </div>
  );
};

export default DesktopInventory;
