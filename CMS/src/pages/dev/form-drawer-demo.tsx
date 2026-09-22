import type { GridColDef } from '@mui/x-data-grid';

import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { DataGrid } from '@mui/x-data-grid';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { exportExcel } from 'src/utils/export-excel';

import { useSnackbar } from 'src/components/snackbar';
import { FormDrawer, createDrawerStore } from 'src/components/form-drawer';

type DemoBook = { id: string; title: string; author: string };
type Values = Omit<DemoBook, 'id'>;
const useDemoDrawer = createDrawerStore();
const initialRows: DemoBook[] = [
  { id: '1', title: 'Dế Mèn phiêu lưu ký', author: 'Tô Hoài' },
  { id: '2', title: 'Tắt đèn', author: 'Ngô Tất Tố' },
];

export default function FormDrawerDemo() {
  const [rows, setRows] = useState(initialRows);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { success } = useSnackbar();
  const selection = useDemoDrawer((state) => state.selection);
  const show = useDemoDrawer((state) => state.show);
  const close = useDemoDrawer((state) => state.close);
  const selected = rows.find((row) => row.id === selection?.id);
  const columns: GridColDef<DemoBook>[] = [
    { field: 'title', headerName: 'Tên sách', flex: 1, minWidth: 200 },
    { field: 'author', headerName: 'Tác giả', width: 180 },
    {
      field: 'actions',
      headerName: 'Thao tác',
      width: 160,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <>
          <Button onClick={() => show({ mode: 'edit', id: row.id })}>Sửa</Button>
          <Button color="error" onClick={() => show({ mode: 'delete', id: row.id })}>
            Xóa
          </Button>
        </>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Danh mục sách
      </Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        Dữ liệu minh họa. Thay đổi chỉ lưu trong bộ nhớ trang này.
      </Alert>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button variant="contained" onClick={() => show({ mode: 'create' })}>
          Thêm sách
        </Button>
        <Button
          variant="outlined"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            setError(null);
            try {
              await exportExcel({
                fileName: 'sach-minh-hoa',
                rows,
                columns: [
                  { header: 'Mã sách', value: (row) => row.id },
                  { header: 'Tên sách', value: (row) => row.title, width: 40 },
                  { header: 'Tác giả', value: (row) => row.author },
                ],
              });
            } catch {
              setError('Không thể xuất dữ liệu. Vui lòng thử lại.');
            } finally {
              setExporting(false);
            }
          }}
        >
          Xuất dữ liệu minh họa
        </Button>
      </Box>
      <Box sx={{ height: 400 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          disableRowSelectionOnClick
          pageSizeOptions={[20]}
          initialState={{ pagination: { paginationModel: { pageSize: 20, page: 0 } } }}
        />
      </Box>
      {selection && selection.mode !== 'view' && (
        <DemoForm
          key={`${selection.mode}:${selection.id ?? 'new'}`}
          mode={selection.mode}
          initial={selected ?? { title: '', author: '' }}
          close={close}
          save={async (values) => {
            if (selection.mode === 'delete') {
              setRows((current) => current.filter((row) => row.id !== selection.id));
              success('Đã xóa sách khỏi danh mục.');
            } else if (selection.mode === 'edit') {
              setRows((current) =>
                current.map((row) => (row.id === selection.id ? { ...row, ...values } : row))
              );
              success('Đã lưu thay đổi cho sách.');
            } else {
              setRows((current) => [...current, { id: crypto.randomUUID(), ...values }]);
              success('Đã thêm sách mới vào danh mục.');
            }
            close();
          }}
        />
      )}
    </Box>
  );
}

function DemoForm({
  mode,
  initial,
  close,
  save,
}: {
  mode: 'create' | 'edit' | 'delete';
  initial: Values;
  close: () => void;
  save: (values: Values) => Promise<void>;
}) {
  const methods = useForm<Values>({ defaultValues: initial });
  return (
    <FormProvider {...methods}>
      <FormDrawer
        open
        mode={mode}
        title={mode === 'create' ? 'Thêm sách' : mode === 'edit' ? 'Sửa sách' : 'Xóa sách minh họa'}
        description={
          mode === 'delete'
            ? 'Xác nhận xóa dòng dữ liệu minh họa này.'
            : 'Nhập thông tin sách vào biểu mẫu.'
        }
        dirty={methods.formState.isDirty}
        submitting={methods.formState.isSubmitting}
        onClose={close}
        onSubmit={methods.handleSubmit(save)}
      >
        {mode === 'delete' ? (
          <Typography>{initial.title}</Typography>
        ) : (
          <Box sx={{ display: 'grid', gap: 3 }}>
            <TextField
              autoFocus
              label="Tên sách"
              {...methods.register('title', {
                required: 'Vui lòng nhập tên sách',
                validate: (value) => !!value.trim() || 'Vui lòng nhập tên sách',
              })}
              error={!!methods.formState.errors.title}
              helperText={methods.formState.errors.title?.message}
            />
            <TextField label="Tác giả" {...methods.register('author')} />
          </Box>
        )}
      </FormDrawer>
    </FormProvider>
  );
}
