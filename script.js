document.addEventListener("DOMContentLoaded", async () => {
  console.log("Script.js is loaded!")

  const canvas = document.getElementById("cityMap")
  const ctx = canvas.getContext("2d")

  // Make canvas responsive
  function resizeCanvas() {
    const container = canvas.parentElement
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight
  }

  window.addEventListener("resize", () => {
    resizeCanvas()
    if (cityData) {
      drawCityMap(cityData.nodes, cityData.edges, selectedPath)
    }
  })

  resizeCanvas()

  let cityData = null
  const nodePositions = {}
  let selectedStart = null
  let selectedEnd = null
  let selectedPath = []
  let hoveredNode = null

  // Fetch city data from the backend
  async function fetchCityData() {
    try {
      const response = await fetch("/city-data")
      if (!response.ok) throw new Error("Failed to fetch city data")
      cityData = await response.json()
      console.log("City Data:", cityData)
      calculateNodePositions()
      drawCityMap(cityData.nodes, cityData.edges, [])
      setupCanvasInteraction()
    } catch (error) {
      console.error("Error fetching city data:", error)
    }
  }

  function calculateNodePositions() {
    const padding = 50
    const availableWidth = canvas.width - padding * 2
    const availableHeight = canvas.height - padding * 2

    // Calculate grid dimensions
    const nodeCount = cityData.nodes.length
    const cols = Math.ceil(Math.sqrt(nodeCount))
    const rows = Math.ceil(nodeCount / cols)

    const cellWidth = availableWidth / cols
    const cellHeight = availableHeight / rows

    cityData.nodes.forEach((node, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)

      const x = padding + col * cellWidth + cellWidth / 2
      const y = padding + row * cellHeight + cellHeight / 2

      nodePositions[node.id] = { x, y }
    })
  }

  function drawCityMap(nodes, edges, pathEdges) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw edges
    edges.forEach((edge) => {
      const start = nodePositions[edge.start]
      const end = nodePositions[edge.end]

      if (!start || !end) return

      const isInPath = pathEdges.some(
        (pathEdge) =>
          (pathEdge.start === edge.start && pathEdge.end === edge.end) ||
          (pathEdge.start === edge.end && pathEdge.end === edge.start),
      )

      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.strokeStyle = isInPath ? "#f59e0b" : "#94a3b8"
      ctx.lineWidth = isInPath ? 3 : 2
      ctx.stroke()

      // Draw weight
      const midX = (start.x + end.x) / 2
      const midY = (start.y + end.y) / 2

      // Draw weight background
      ctx.fillStyle = "white"
      const weightText = edge.weight.toString()
      const textMetrics = ctx.measureText(weightText)
      const padding = 4
      ctx.fillRect(
        midX - textMetrics.width / 2 - padding,
        midY - 8 - padding,
        textMetrics.width + padding * 2,
        16 + padding * 2,
      )

      ctx.fillStyle = isInPath ? "#b45309" : "#475569"
      ctx.font = "bold 12px Inter"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(edge.weight, midX, midY)
    })

    // Draw nodes
    nodes.forEach((node) => {
      const pos = nodePositions[node.id]
      if (!pos) return

      const isStart = selectedStart === node.id
      const isEnd = selectedEnd === node.id
      const isHovered = hoveredNode === node.id

      // Node circle
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, isHovered ? 22 : 20, 0, Math.PI * 2)

      if (isStart) {
        ctx.fillStyle = "#10b981" // Green for start
      } else if (isEnd) {
        ctx.fillStyle = "#f97316" // Orange for end
      } else {
        ctx.fillStyle = "#4f46e5" // Default blue
      }

      ctx.fill()

      if (isHovered) {
        ctx.strokeStyle = "#0f172a"
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Node label
      ctx.fillStyle = "white"
      ctx.font = "bold 14px Inter"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(node.id, pos.x, pos.y)

      // Node name below
      ctx.fillStyle = "#0f172a"
      ctx.font = "12px Inter"
      ctx.fillText(node.name || `Node ${node.id}`, pos.x, pos.y + 30)
    })
  }

  function setupCanvasInteraction() {
    canvas.addEventListener("mousemove", (event) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = event.clientX - rect.left
      const mouseY = event.clientY - rect.top

      // Check if mouse is over any node
      let foundNode = null
      cityData.nodes.forEach((node) => {
        const pos = nodePositions[node.id]
        if (!pos) return

        const distance = Math.sqrt(Math.pow(mouseX - pos.x, 2) + Math.pow(mouseY - pos.y, 2))

        if (distance <= 20) {
          foundNode = node.id
          canvas.style.cursor = "pointer"
        }
      })

      if (foundNode !== hoveredNode) {
        hoveredNode = foundNode
        if (!foundNode) {
          canvas.style.cursor = "default"
        }
        drawCityMap(cityData.nodes, cityData.edges, selectedPath)
      }
    })

    canvas.addEventListener("click", (event) => {
      if (hoveredNode !== null) {
        if (selectedStart === null) {
          selectedStart = hoveredNode
          document.getElementById("start").value = hoveredNode
        } else if (selectedEnd === null) {
          selectedEnd = hoveredNode
          document.getElementById("end").value = hoveredNode
        } else {
          // Reset and start over
          selectedStart = hoveredNode
          selectedEnd = null
          selectedPath = []
          document.getElementById("start").value = hoveredNode
          document.getElementById("end").value = ""

          // Hide result card when resetting
          document.getElementById("resultCard").style.display = "none"
        }
        drawCityMap(cityData.nodes, cityData.edges, selectedPath)
      }
    })
  }

  // Form submission
  document.getElementById("shortestPathForm").addEventListener("submit", async function (event) {
    event.preventDefault()

    // Show loading state
    const submitButton = this.querySelector('button[type="submit"]')
    const originalButtonText = submitButton.textContent
    submitButton.disabled = true
    submitButton.textContent = "Calculating..."

    const start = Number.parseInt(document.getElementById("start").value)
    const end = Number.parseInt(document.getElementById("end").value)

    if (isNaN(start) || isNaN(end)) {
      alert("Please enter valid node numbers")
      submitButton.disabled = false
      submitButton.textContent = originalButtonText
      return
    }

    try {
      console.log(`Sending request for path from ${start} to ${end}`)

      const response = await fetch("/shortest-path", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: start, end: end }),
      })

      const data = await response.json()
      console.log("Response data:", data)

      // Reset button state
      submitButton.disabled = false
      submitButton.textContent = originalButtonText

      if (data.error) {
        // Show error but don't throw
        document.getElementById("resultCard").style.display = "block"
        document.getElementById("pathResult").innerHTML = `<strong>Error:</strong> ${data.error}`
        document.getElementById("pathDistance").innerHTML = ""
        document.getElementById("resultCard").scrollIntoView({ behavior: "smooth" })
        return
      }

      // Update selected nodes
      selectedStart = start
      selectedEnd = end

      // Create path edges
      selectedPath = []
      if (data.path && data.path.length > 1) {
        for (let i = 0; i < data.path.length - 1; i++) {
          selectedPath.push({
            start: data.path[i],
            end: data.path[i + 1],
          })
        }
      }

      // Redraw map with path
      drawCityMap(cityData.nodes, cityData.edges, selectedPath)

      // Show result
      const resultCard = document.getElementById("resultCard")
      resultCard.style.display = "block"

      // Format path with node names
      let pathText = ""
      if (data.path && data.path.length > 0) {
        pathText = data.path
          .map((nodeId) => {
            const node = cityData.nodes.find((n) => n.id === nodeId)
            return node ? `${node.name} (${nodeId})` : nodeId
          })
          .join(" → ")
        document.getElementById("pathResult").innerHTML = `<strong>Shortest Path:</strong> ${pathText}`
      } else {
        document.getElementById("pathResult").innerHTML = "<strong>No path found</strong> between these nodes."
      }

      if (data.distance !== undefined) {
        document.getElementById("pathDistance").innerHTML = `<strong>Total Distance:</strong> ${data.distance}`
      } else {
        document.getElementById("pathDistance").innerHTML = ""
      }

      // Scroll to result
      resultCard.scrollIntoView({ behavior: "smooth" })
    } catch (error) {
      console.error("Error calculating shortest path:", error)

      // Reset button state
      submitButton.disabled = false
      submitButton.textContent = originalButtonText

      // Show error message
      document.getElementById("resultCard").style.display = "block"
      document.getElementById("pathResult").innerHTML =
        `<strong>Error:</strong> Failed to calculate shortest path. Please try again.`
      document.getElementById("pathDistance").innerHTML = ""
      document.getElementById("resultCard").scrollIntoView({ behavior: "smooth" })
    }
  })

  // Initialize
  await fetchCityData()
})

