import './globals.css'

export const metadata = {
  title: 'FullPro - Dashboard ML',
  description: 'Dashboard de vendas e publicidade do Mercado Livre',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
