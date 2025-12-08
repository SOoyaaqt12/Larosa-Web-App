// Sales Trend Chart
const salesCtx = document.getElementById("salesChart").getContext("2d");
const salesChart = new Chart(salesCtx, {
  type: "line",
  data: {
    labels: [
      "20 Mar",
      "23 Mar",
      "26 Mar",
      "29 Mar",
      "1 Apr",
      "4 Apr",
      "7 Apr",
      "10 Apr",
      "13 Apr",
      "16 Apr",
      "19 Apr",
      "22 Apr",
      "25 Apr",
      "28 Apr",
      "1 Mei",
    ],
    datasets: [
      {
        label: "Sales",
        data: [
          3000000, 5000000, 8000000, 6000000, 7000000, 9000000, 6000000,
          7000000, 5000000, 8000000, 7000000, 6000000, 8000000, 10000000,
          15000000,
        ],
        borderColor: "#2d5a2d",
        backgroundColor: "rgba(45, 90, 45, 0.1)",
        tension: 0.4,
        fill: true,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            return "Rp" + value / 1000000 + ",000,000";
          },
        },
      },
    },
  },
});

// Category Chart
const categoryCtx = document.getElementById("categoryChart").getContext("2d");
const categoryChart = new Chart(categoryCtx, {
  type: "doughnut",
  data: {
    labels: [
      "Teraso",
      "Standing Kayu",
      "Pot Plastik",
      "Tanaman",
      "Tanaman Dela",
      "Gerabah",
      "Medan",
      "ADD",
    ],
    datasets: [
      {
        data: [1834, 400, 317, 250, 200, 180, 150, 100],
        backgroundColor: [
          "#ff9800",
          "#ff6b00",
          "#00bcd4",
          "#4caf50",
          "#8bc34a",
          "#ffeb3b",
          "#ffc107",
          "#f44336",
        ],
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: {
          generateLabels: function (chart) {
            const data = chart.data;
            return data.labels.map((label, i) => {
              const value = data.datasets[0].data[i];
              const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return {
                text: `${label} - ${percentage}%`,
                fillStyle: data.datasets[0].backgroundColor[i],
                hidden: false,
                index: i,
              };
            });
          },
        },
      },
    },
  },
});
