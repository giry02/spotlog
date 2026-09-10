/* Keep column context when summary tables stack on a narrow screen. */
document.querySelectorAll('.table-wrap table').forEach(table => {
  const headings = [...table.querySelectorAll('thead th')].map(cell => cell.textContent);
  table.querySelectorAll('tbody tr').forEach(row => {
    [...row.children].forEach((cell, index) => {
      if (cell.tagName === 'TD') cell.dataset.label = headings[index] || '';
    });
  });
});
