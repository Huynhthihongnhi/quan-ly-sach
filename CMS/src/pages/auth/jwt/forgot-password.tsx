import { CONFIG } from 'src/global-config';

import { JwtForgotPasswordView } from 'src/auth/view/jwt';

// ----------------------------------------------------------------------

const metadata = { title: `Quên mật khẩu | ${CONFIG.appName}` };

export default function Page() {
  return (
    <>
      <title>{metadata.title}</title>

      <JwtForgotPasswordView />
    </>
  );
}
