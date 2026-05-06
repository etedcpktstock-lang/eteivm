import React, { useMemo, useState } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  eachDayOfInterval,
  isToday,
} from 'date-fns';
import { th } from 'date-fns/locale';
import { safeParseDate, formatThaiTime } from '../../utils/dateTimeUtils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DesktopCalendarProps {
  transactions: any[];
  items: any[];
}

const DesktopCalendar: React.FC<DesktopCalendarProps> = ({ transactions }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const dayTransactions = useMemo(() => {
    return transactions.filter((t) => {
      try {
        const d = safeParseDate(t['วัน-เวลา']);
        return isSameDay(d, selectedDate);
      } catch {
        return false;
      }
    });
  }, [transactions, selectedDate]);

  const getDayCount = (day: Date) => {
    return transactions.filter((t) => {
      try {
        const d = safeParseDate(t['วัน-เวลา']);
        return isSameDay(d, day);
      } catch {
        return false;
      }
    }).length;
  };

  const weekDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  return (
    <div className="desktop-page">
      <div className="desktop-page-header">
        <div className="desktop-page-header-main">
          <h2 className="plain-page-title">ปฏิทินงาน</h2>
          <p className="plain-subtitle">ดูรายการเคลื่อนไหวตามวันและเปิดรายละเอียดจากด้านขวา</p>
        </div>
      </div>

      <div className="desktop-split-grid desktop-split-grid--wide-right">
        <div className="plain-card">
          <div className="plain-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{format(currentMonth, 'MMMM yyyy', { locale: th })}</div>
              <div className="plain-subtitle">ปฏิทินรายการเคลื่อนไหว</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="plain-logout" style={{ width: 70 }} onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()); }}>วันนี้</button>
              <button className="plain-logout" style={{ width: 36 }} onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft size={14} /></button>
              <button className="plain-logout" style={{ width: 36 }} onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight size={14} /></button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderTop: '1px solid #e5e7eb' }}>
            {weekDays.map((day) => (
              <div key={day} style={{ padding: 8, textAlign: 'center', fontSize: 12, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{day}</div>
            ))}

            {calendarDays.map((day) => {
              const count = getDayCount(day);
              const selected = isSameDay(day, selectedDate);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  style={{
                    minHeight: 84,
                    border: 'none',
                    borderRight: '1px solid #f1f5f9',
                    borderBottom: '1px solid #f1f5f9',
                    background: selected ? '#ecfdf5' : '#fff',
                    opacity: isSameMonth(day, currentMonth) ? 1 : 0.35,
                    textAlign: 'left',
                    padding: 8,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: isToday(day) ? 700 : 500, color: isToday(day) ? '#06c167' : '#374151' }}>
                    {format(day, 'd')}
                  </div>
                  {count > 0 && <div style={{ fontSize: 11, color: '#06c167', marginTop: 4 }}>{count} รายการ</div>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="plain-card">
          <div className="plain-card-header">
            รายการวันที่ {format(selectedDate, 'd MMMM yyyy', { locale: th })}
          </div>
          <div className="desktop-scroll desktop-scroll--tall">
            <table className="plain-table">
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>สถานะ</th>
                  <th>รายการ</th>
                  <th>จำนวน</th>
                </tr>
              </thead>
              <tbody>
                {dayTransactions.map((txn, i) => (
                  <tr key={i}>
                    <td>{formatThaiTime(txn['วัน-เวลา'])}</td>
                    <td>{txn.สถานะ || '-'}</td>
                    <td>{txn.รายการ || '-'}</td>
                    <td>{txn.จำนวน || 0} {txn.หน่วย || 'ชิ้น'}</td>
                  </tr>
                ))}
                {dayTransactions.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#6b7280' }}>ไม่มีกิจกรรมในวันนี้</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesktopCalendar;
