import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
];

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'select';
}

export function LanguageSelector({ variant = 'dropdown' }: LanguageSelectorProps) {
  const { i18n, t } = useTranslation();
  const normalizedLang = i18n.language?.split('-')[0] || i18n.language;

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    try { localStorage.setItem('i18nextLng', languageCode); } catch {}
  };

  const currentLanguage = languages.find((lang) => lang.code === normalizedLang) || languages[0];

  if (variant === 'select') {
    return (
      <Select value={normalizedLang} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t('language.selectLanguage')} />
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.nativeName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title={t('language.selectLanguage')}>
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={normalizedLang === lang.code ? 'bg-accent' : ''}
          >
            {lang.nativeName}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
