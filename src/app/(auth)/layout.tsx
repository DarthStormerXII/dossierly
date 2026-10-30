/** Sign-in and sign-up are full screen: no site header or footer. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main id="main">{children}</main>;
}
