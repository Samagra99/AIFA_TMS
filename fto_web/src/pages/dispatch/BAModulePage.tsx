import { useState } from 'react'
import { Card, Button, PageLoader, Modal, Badge } from '@/components/ui'
import { Beaker, Plus, Search, CheckCircle2, XCircle, Stethoscope } from 'lucide-react'
import { useBAEquipment, useBATests, useBASearchCandidates, useCreateBAEquipment, useCreateBATest } from '@/api/hooks/useBA'
import { toast } from 'sonner'
import dayjs from 'dayjs'

export function BAModulePage() {
  const [activeTab, setActiveTab] = useState<'record' | 'equipment'>('record')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
          <Beaker className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Breath Analyzer</h1>
          <p className="text-sm text-slate-500">Manage breath analyzer tests and equipment.</p>
        </div>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex gap-6">
          <button
            onClick={() => setActiveTab('record')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'record'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Record Test
          </button>
          <button
            onClick={() => setActiveTab('equipment')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${
              activeTab === 'equipment'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Equipment
          </button>
        </nav>
      </div>

      {activeTab === 'record' ? <RecordTestTab /> : <EquipmentTab />}
    </div>
  )
}

function RecordTestTab() {
  const { data: testsData, isLoading } = useBATests()
  const { data: equipData } = useBAEquipment()
  const createTest = useCreateBATest()
  
  const [searchQuery, setSearchQuery] = useState('')
  const { data: candidates } = useBASearchCandidates(searchQuery)

  const [form, setForm] = useState({
    person: '',
    person_name: '',
    equipment: '',
    test_serial_number: '',
    test_time: dayjs().format('YYYY-MM-DDTHH:mm'),
    result: 'PASS' as 'PASS' | 'FAIL',
    alcohol_level: '0.000',
    remarks: '',
  })
  
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.person || !form.equipment || !form.test_serial_number) {
      toast.error('Please fill all required fields')
      return
    }
    
    try {
      await createTest.mutateAsync({
        person: form.person,
        equipment: form.equipment,
        equipment_number: activeEquip.find(e => e.id === form.equipment)?.equipment_number || '',
        test_serial_number: form.test_serial_number,
        test_time: dayjs(form.test_time).toISOString(),
        result: form.result,
        alcohol_level: form.alcohol_level,
        remarks: form.remarks || null,
      })
      toast.success('BA test recorded successfully')
      setForm({ ...form, person: '', person_name: '', test_serial_number: '', alcohol_level: '0.000', remarks: '' })
      setSearchQuery('')
    } catch (err: any) {
      toast.error('Failed to record test', { description: err?.response?.data?.detail })
    }
  }

  const activeEquip = equipData?.results?.filter(e => e.is_active) || []

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Stethoscope className="h-4 w-4" /> New Test Record
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Candidate Search *</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name or ID..."
                  value={form.person_name || searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setForm({ ...form, person: '', person_name: '' })
                    setShowSearchDropdown(true)
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              
              {showSearchDropdown && searchQuery.length >= 2 && candidates && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {candidates.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-slate-500">No candidates found</div>
                  ) : (
                    candidates.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, person: c.id, person_name: c.name })
                          setSearchQuery('')
                          setShowSearchDropdown(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <div className="font-medium text-slate-900 dark:text-white">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.role} {c.employee_id && `· ${c.employee_id}`}</div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Equipment *</label>
              <select
                value={form.equipment}
                onChange={e => setForm({ ...form, equipment: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Select Equipment...</option>
                {activeEquip.map(e => (
                  <option key={e.id} value={e.id}>{e.equipment_number} ({e.model_name})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Serial No. *</label>
                <input
                  type="text"
                  value={form.test_serial_number}
                  onChange={e => setForm({ ...form, test_serial_number: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div className="col-span-3">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Time *</label>
                <input
                  type="datetime-local"
                  value={form.test_time}
                  onChange={e => setForm({ ...form, test_time: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Result *</label>
                <select
                  value={form.result}
                  onChange={e => setForm({ ...form, result: e.target.value as 'PASS' | 'FAIL' })}
                  className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold ${
                    form.result === 'PASS' 
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400' 
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400'
                  }`}
                >
                  <option value="PASS">PASS</option>
                  <option value="FAIL">FAIL</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">BAC Level (%)</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.alcohol_level}
                  onChange={e => setForm({ ...form, alcohol_level: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Remarks</label>
              <textarea
                value={form.remarks}
                onChange={e => setForm({ ...form, remarks: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <Button type="submit" className="w-full" loading={createTest.isPending}>
              Record Test
            </Button>
          </form>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Tests</h2>
          </div>
          
          {isLoading ? <div className="p-8"><PageLoader /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Time & Serial No.</th>
                    <th className="px-4 py-3 font-medium">Candidate</th>
                    <th className="px-4 py-3 font-medium">Equipment</th>
                    <th className="px-4 py-3 font-medium">Result</th>
                    <th className="px-4 py-3 font-medium">BAC %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                  {testsData?.results?.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No recent tests found</td></tr>
                  )}
                  {testsData?.results?.map((test) => (
                    <tr key={test.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">{dayjs(test.test_time).format('DD MMM, HH:mm')}</div>
                        <div className="text-xs text-slate-500 font-mono">SN: {test.test_serial_number}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-200">{test.person_name}</td>
                      <td className="px-4 py-3 text-xs">{test.equipment_display || test.equipment_number}</td>
                      <td className="px-4 py-3">
                        <Badge variant={test.result === 'PASS' ? 'success' : 'danger'} className="font-semibold text-xs">
                          {test.result === 'PASS' ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                          {test.result}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono">{test.alcohol_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function EquipmentTab() {
  const { data, isLoading } = useBAEquipment()
  const createEquipment = useCreateBAEquipment()
  const [showModal, setShowModal] = useState(false)
  
  const [form, setForm] = useState({
    equipment_number: '',
    serial_number: '',
    model_name: '',
    calibration_date: '',
    calibration_due_date: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createEquipment.mutateAsync({
        ...form,
        calibration_date: form.calibration_date || null,
        calibration_due_date: form.calibration_due_date || null,
        is_active: true
      })
      toast.success('Equipment added')
      setShowModal(false)
      setForm({ equipment_number: '', serial_number: '', model_name: '', calibration_date: '', calibration_due_date: '' })
    } catch (err: any) {
      toast.error('Failed to add equipment')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Active Equipment</h2>
        <Button onClick={() => setShowModal(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Equipment
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? <div className="p-8"><PageLoader /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 font-medium">Equipment No.</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Serial No.</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Cal Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
                {data?.results?.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No equipment found</td></tr>
                )}
                {data?.results?.map((eq) => (
                  <tr key={eq.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{eq.equipment_number}</td>
                    <td className="px-4 py-3">{eq.model_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{eq.serial_number}</td>
                    <td className="px-4 py-3">
                      <Badge variant={eq.is_active ? 'success' : 'default'} className="text-xs">
                        {eq.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {eq.calibration_due_date ? dayjs(eq.calibration_due_date).format('DD MMM YYYY') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add BA Equipment">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Equipment No. *</label>
            <input type="text" required value={form.equipment_number} onChange={e => setForm({...form, equipment_number: e.target.value})}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Model Name *</label>
            <input type="text" required value={form.model_name} onChange={e => setForm({...form, model_name: e.target.value})}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Serial No. *</label>
            <input type="text" required value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3 dark:border-slate-700">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Calibration Date</label>
              <input type="date" value={form.calibration_date} onChange={e => setForm({...form, calibration_date: e.target.value})}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Cal. Due Date</label>
              <input type="date" value={form.calibration_due_date} onChange={e => setForm({...form, calibration_due_date: e.target.value})}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <Button type="submit" loading={createEquipment.isPending}>Add Equipment</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
