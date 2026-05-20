"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

type Promotion = {
  id: number;
  title: string;
  image_url: string;
  link_url?: string | null;
  is_active: boolean;
}

export function FloatingPromotions({ promotions }: { promotions: Promotion[] }) {
  const [isVisible, setIsVisible] = useState(false)

  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    // Tampilkan hanya jika belum ditutup di sesi ini
    const isClosed = sessionStorage.getItem("promotions_closed")
    if (!isClosed && promotions.length > 0) {
      // Tambahkan sedikit delay agar tidak terlalu agresif saat baru login
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [promotions])

  useEffect(() => {
    if (!isVisible || promotions.length <= 1) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % promotions.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [isVisible, promotions.length])

  const handleClose = () => {
    setIsVisible(false)
    sessionStorage.setItem("promotions_closed", "true")
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] bg-white dark:bg-slate-900 shadow-2xl rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hidden lg:block">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          Info Terbaru
        </h3>
        <button 
          onClick={handleClose}
          className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors bg-transparent border-none p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700"
          title="Tutup Iklan"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Slideshow Content */}
      <div className="relative w-full h-[250px] bg-slate-50 overflow-hidden">
        <div 
          className="absolute top-0 bottom-0 flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 400}px)` }}
        >
          {promotions.map((promo) => (
            <div 
              key={promo.id} 
              className="w-[400px] h-full flex-shrink-0 flex flex-col p-4"
            >
              <div className="relative w-full h-36 bg-slate-200 rounded-lg overflow-hidden mb-3 border border-slate-200 dark:border-slate-700">
                {promo.link_url ? (
                  <a href={promo.link_url} target="_blank" rel="noreferrer" className="block w-full h-full">
                    <img src={promo.image_url} alt={promo.title} className="w-full h-full object-cover" />
                  </a>
                ) : (
                  <img src={promo.image_url} alt={promo.title} className="w-full h-full object-cover" />
                )}
              </div>
              <h4 className="font-bold text-slate-800 dark:text-slate-100 line-clamp-1 text-center">{promo.title}</h4>
            </div>
          ))}
        </div>
        
        {/* Pagination Dots */}
        {promotions.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
            {promotions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-4 bg-slate-800 dark:bg-slate-300' : 'w-1.5 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'}`}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
