import { useState } from 'react'
import './App.css'
import GreenCross from './pages/GreenCross'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
          <GreenCross/>
    </>
  )
}

export default App
