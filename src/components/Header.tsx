import { Home, BookOpen, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header() {
  return (
    <header className="w-full shadow-md bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between p-4">
        {/* Logo / Title */}
        <h1 className="text-xl font-bold text-blue-600">Adhyan Hub</h1>

        {/* Navigation */}
        <nav className="flex gap-6 text-gray-700">
          <a href="/" className="flex items-center gap-1 hover:text-blue-600">
            <Home size={18} /> Home
          </a>
          <a href="/library" className="flex items-center gap-1 hover:text-blue-600">
            <BookOpen size={18} /> Library
          </a>
          <a href="/profile" className="flex items-center gap-1 hover:text-blue-600">
            <User size={18} /> Profile
          </a>
        </nav>

        {/* Right Side Action */}
        <Button>Login</Button>
      </div>
    </header>
  );
}
