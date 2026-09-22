import type { ApiError } from 'src/lib/http';

import { z as zod } from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useBoolean } from 'minimal-shared/hooks';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';

import { FormHead } from '../../components/form-head';
import { FormReturnLink } from '../../components/form-return-link';

// ----------------------------------------------------------------------
// Shared view for the two token flows: reset password and account activation.
// The token comes from the email link (?token=...); the caller supplies which BE call to make.
// ----------------------------------------------------------------------

export type UpdatePasswordSchemaType = zod.infer<typeof UpdatePasswordSchema>;

// Keep 12 in sync with the BE NEW_PASSWORD_MIN_LENGTH (BE/src/modules/identity/password-policy.ts);
// a smaller client minimum would let the form submit values the BE rejects with 422.
export const UpdatePasswordSchema = zod
  .object({
    password: zod
      .string()
      .min(1, { message: 'Vui lòng nhập mật khẩu mới.' })
      .min(12, { message: 'Mật khẩu tối thiểu 12 ký tự.' }),
    confirmPassword: zod.string().min(1, { message: 'Vui lòng nhập lại mật khẩu.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu nhập lại không khớp.',
    path: ['confirmPassword'],
  });

type Props = {
  title: string;
  description: string;
  submitLabel: string;
  successMessage: string;
  complete: (params: { token: string; newPassword: string }) => Promise<void>;
};

export function JwtUpdatePasswordView({
  title,
  description,
  submitLabel,
  successMessage,
  complete,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const showPassword = useBoolean();
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const methods = useForm<UpdatePasswordSchemaType>({
    resolver: zodResolver(UpdatePasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      setErrorMessage(null);
      await complete({ token, newPassword: data.password });
      setSubmitted(true);
    } catch (error) {
      const apiError = error as ApiError;
      setErrorMessage(apiError?.message ?? 'Không thể hoàn tất. Liên kết có thể đã hết hạn.');
    }
  });

  const renderHead = (
    <FormHead
      title={title}
      description={description}
      sx={{ textAlign: { xs: 'center', md: 'left' } }}
    />
  );

  const returnLink = <FormReturnLink href={paths.auth.jwt.signIn} label="Quay lại đăng nhập" />;

  if (!token) {
    return (
      <>
        {renderHead}
        <Alert severity="error" sx={{ mb: 3 }}>
          Liên kết không hợp lệ hoặc thiếu mã. Vui lòng mở lại liên kết trong email.
        </Alert>
        {returnLink}
      </>
    );
  }

  return (
    <>
      {renderHead}

      {submitted ? (
        <>
          <Alert severity="success" sx={{ mb: 3 }}>
            {successMessage}
          </Alert>
          <Button
            fullWidth
            size="large"
            variant="contained"
            onClick={() => router.push(paths.auth.jwt.signIn)}
          >
            Đến trang đăng nhập
          </Button>
        </>
      ) : (
        <>
          {!!errorMessage && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {errorMessage}
            </Alert>
          )}

          <Form methods={methods} onSubmit={onSubmit}>
            <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
              <Field.Text
                name="password"
                label="Mật khẩu mới"
                type={showPassword.value ? 'text' : 'password'}
                slotProps={{
                  inputLabel: { shrink: true },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={showPassword.onToggle} edge="end">
                          <Iconify
                            icon={showPassword.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'}
                          />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />

              <Field.Text
                name="confirmPassword"
                label="Nhập lại mật khẩu mới"
                type={showPassword.value ? 'text' : 'password'}
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <Button
                fullWidth
                color="inherit"
                size="large"
                type="submit"
                variant="contained"
                loading={isSubmitting}
                loadingIndicator="Đang xử lý..."
              >
                {submitLabel}
              </Button>
            </Box>
          </Form>
        </>
      )}

      {returnLink}
    </>
  );
}
