import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function BottomSheet({ open, onClose, children }) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const startY = useRef(0)

  useEffect(() => {
    if (open) {
      setMounted(true)
      // Double rAF: ensure mount before CSS transition fires
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      )
      return () => cancelAnimationFrame(id)
    } else {
      setVisible(false)
      setDragOffset(0)
      const t = setTimeout(() => setMounted(false), 380)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!mounted) return null

  function onHandleTouchStart(e) {
    startY.current = e.touches[0].clientY
    setIsDragging(true)
  }

  function onHandleTouchMove(e) {
    const delta = Math.max(0, e.touches[0].clientY - startY.current)
    setDragOffset(delta)
  }

  function onHandleTouchEnd() {
    setIsDragging(false)
    if (dragOffset > 100) {
      onClose()
    } else {
      setDragOffset(0)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100]"
      style={{
        backgroundColor: visible ? 'rgba(0,0,0,0.72)' : 'transparent',
        transition: 'background-color 350ms ease',
      }}
      onClick={onClose}
    >
      <div
        className="absolute left-0 right-0 bottom-0 flex flex-col rounded-t-3xl"
        style={{
          backgroundColor: 'var(--bg-surf)',
          maxHeight: '92vh',
          transform: visible ? `translateY(${dragOffset}px)` : 'translateY(100%)',
          transition: isDragging ? 'none' : 'transform 350ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — touch target for swipe-to-dismiss */}
        <div
          className="flex-shrink-0 flex justify-center pt-3 pb-2"
          style={{ touchAction: 'none', cursor: 'grab' }}
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'var(--border)' }} />
        </div>

        {/* Scrollable content area */}
        <div className="overflow-y-auto flex-1" style={{ overscrollBehavior: 'contain' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
