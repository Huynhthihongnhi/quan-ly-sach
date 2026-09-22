import { z as zod } from 'zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

import { paths } from 'src/routes/paths';

import { Form, Field } from 'src/components/hook-form';

import { forgotPassword } from '../../context/jwt';
import { FormHead } from '../../components/form-head';
import { FormReturnLink } from '../../components/form-return-link';

// ----------------------------------------------------------------------

export type ForgotPasswordSchemaType = zod.infer<typeof ForgotPasswordSchema>;

export const ForgotPasswordSchema = zod.object({
  email: zod
    .string()
    .min(1, { message: 'Vui lòng nhập email.' })
    .email({ message: 'Email không hợp lệ.' }),
});

// ----------------------------------------------------------------------

export function JwtForgotPasswordView() {
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const methods = useForm<ForgotPasswordSchemaType>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      setErrorMessage(null);
      await forgotPassword(data.email);
      setSubmitted(true);
    } catch {
      setErrorMessage('Không thể gửi yêu cầu. Vui lòng thử lại.');
    }
  });

  return (
    <>
      <FormHead
        title="Quên mật khẩu"
        description="Nhập email của bạn để nhận hướng dẫn đặt lại mật khẩu."
        sx={{ textAlign: { xs: 'center', md: 'left' } }}
      />

      {submitted ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          Nếu email nằm trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Vui lòng kiểm
          tra hộp thư.
        </Alert>
      ) : (
        <>
          {!!errorMessage && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {errorMessage}
            </Alert>
          )}

          <Form methods={methods} onSubmit={onSubmit}>
            <Box sx={{ gap: 3, display: 'flex', flexDirection: 'column' }}>
              <Field.Text name="email" label="Email" slotProps={{ inputLabel: { shrink: true } }} />

              <Button
                fullWidth
                color="inherit"
                size="large"
                type="submit"
                variant="contained"
                loading={isSubmitting}
                loadingIndicator="Đang gửi..."
              >
                Gửi yêu cầu
              </Button>
            </Box>
          </Form>
        </>
      )}

      <FormReturnLink href={paths.auth.jwt.signIn} label="Quay lại đăng nhập" />
    </>
  );
}
