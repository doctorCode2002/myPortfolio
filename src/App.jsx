import React from 'react'
import Navbar from './components/Navbar'
import bg from '/bg.png'
export default function App() {
  return (
    <div className='bg-black h-1250 relative'>
      <div className='absolute inset-0'>
        <img src={bg} alt="" className=' w-full object-cover'/>
      </div>
      <Navbar />
    </div>
  )
}
