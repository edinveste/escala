export default function AdminTabBar({ tabs, activeTab, onMudarAba }) {
  return (
    <div className="grid grid-cols-4 gap-1 sm:gap-1.5 bg-surface-850/95 border border-surface-700/80 p-1.5 rounded-2xl shadow-sm">
      {tabs.map((tab) => {
        const TabIcon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onMudarAba(tab.id)}
            title={tab.tooltip}
            aria-label={tab.label}
            className={`flex items-center justify-center p-2.5 rounded-xl transition-all min-h-[44px] select-none ${
              isActive
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25 font-bold'
                : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700/60'
            }`}
          >
            <TabIcon
              className={`w-5 h-5 flex-shrink-0 transition-transform ${
                isActive ? 'text-white scale-110' : 'text-gray-400'
              }`}
            />
          </button>
        )
      })}
    </div>
  )
}

