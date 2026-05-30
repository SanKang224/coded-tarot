import { useInputMode } from '@/lib/useInputMode';

// selectedIndex: number;
type MenuSelectorProps = {
  options: string[];
  selectedIndex: number; 
  onSelect: (option: string) => void;
};

export default function MenuSelector({ options, selectedIndex, onSelect }: MenuSelectorProps) {
  const isMobile = useInputMode();

  return (
    <div className="flex flex-col gap-2 my-2 font-mono text-[16px]">
      {options.map((option, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <div
            key={option}
            onClick={() => onSelect(option)}
            className={`cursor-pointer flex items-center ${
              isSelected ? 'text-white' : 'text-[#00FF41]'
            }`}
          >
            <span className="w-5 mr-2">{isSelected ? '▶' : ''}</span>
            <span className={isMobile ? 'border border-[#00FF41] px-2 py-1 rounded' : ''}>
              [{option}]
            </span>
          </div>
        );
      })}
    </div>
  );
}