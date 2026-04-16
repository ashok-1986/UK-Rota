// @react-pdf/renderer component — server-side only
// Do NOT import this in client components
import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { WeekView } from '@/types'
import { formatShortDate, formatLongDate, formatTime, fullName, formatWeekRange } from '@/lib/utils'

interface WeeklyRotaPDFProps {
  data: WeekView
  homeName: string
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    padding: 32,
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
  },
  table: {
    marginTop: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
    minHeight: 28,
    alignItems: 'center',
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    fontSize: 8,
  },
  shiftCol: {
    width: '12%',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  dayCol: {
    width: '12.57%',
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderLeftColor: '#e5e7eb',
    borderLeftWidth: 1,
  },
  shiftName: {
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    fontSize: 9,
  },
  shiftTime: {
    color: '#6b7280',
    fontSize: 7,
    marginTop: 2,
  },
  staffName: {
    color: '#111827',
    fontSize: 8,
  },
  unfilled: {
    color: '#b45309',
    fontSize: 8,
    fontFamily: 'Helvetica-Oblique',
  },
  statusPill: {
    fontSize: 7,
    marginTop: 2,
    color: '#6b7280',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 32,
    right: 32,
    borderTopColor: '#e5e7eb',
    borderTopWidth: 1,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#9ca3af',
  },
})

export function WeeklyRotaPDF({ data, homeName }: WeeklyRotaPDFProps) {
  const days = Object.keys(data.days).sort()

  // Get unique shift templates from the first day
  const shiftTemplates = days[0]
    ? data.days[days[0]].map(c => c.shift)
    : []

  const generatedAt = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Weekly Rota — {homeName}</Text>
          <Text style={styles.subtitle}>
            Week: {days.length > 0 ? formatWeekRange(data.week_start) : data.week_start}
          </Text>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Column headers */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={styles.shiftCol}>
              <Text>Shift</Text>
            </View>
            {days.map(day => (
              <View key={day} style={styles.dayCol}>
                <Text>{formatShortDate(day)}</Text>
              </View>
            ))}
          </View>

          {/* Data rows */}
          {shiftTemplates.map((shift, rowIdx) => (
            <View
              key={shift.id}
              style={[
                styles.tableRow,
                { backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb' },
              ]}
            >
              {/* Shift column */}
              <View style={styles.shiftCol}>
                <Text style={styles.shiftName}>{shift.name}</Text>
                <Text style={styles.shiftTime}>
                  {formatTime(shift.start_time)}–{formatTime(shift.end_time)}
                </Text>
              </View>

              {/* Day columns */}
              {days.map(day => {
                const cell = data.days[day]?.find(c => c.shift.id === shift.id)
                return (
                  <View key={day} style={styles.dayCol}>
                    {cell?.rota_shift ? (
                      <>
                        {cell.staff ? (
                          <Text style={styles.staffName}>
                            {cell.staff.first_name} {cell.staff.last_name}
                          </Text>
                        ) : (
                          <Text style={styles.unfilled}>Unfilled</Text>
                        )}
                        <Text style={styles.statusPill}>
                          {cell.rota_shift.status}
                        </Text>
                      </>
                    ) : (
                      <Text style={{ color: '#d1d5db', fontSize: 8 }}>—</Text>
                    )}
                  </View>
                )
              })}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Generated by CareRota on {generatedAt}
          </Text>
          <Text style={styles.footerText}>
            Confidential — UK GDPR protected data
          </Text>
        </View>
      </Page>
    </Document>
  )
}
