import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 text-center">
      <h1 className="text-6xl font-bold mb-8">
        Bem-vindo ao <span className="text-gradient-instagram">VOXA</span>
      </h1>
      <p className="text-xl mb-12 text-gray-600 max-w-2xl">
        Conecte-se com seus criadores favoritos, envie perguntas com prioridade e apoie quem você admira.
      </p>
      
      <div className="flex gap-6">
        <Link 
          href="/vender" 
          className="bg-gradient-instagram text-white px-8 py-4 rounded-full font-bold text-lg hover:opacity-90 transition-opacity"
        >
          Sou Criador
        </Link>
        <Link 
          href="/perfil/exemplo" 
          className="bg-white text-gray-800 border-2 border-gray-200 px-8 py-4 rounded-full font-bold text-lg hover:border-gray-300 transition-colors"
        >
          Ver Perfil de Exemplo
        </Link>
      </div>
    </main>
  )
}
