// date.utils.js
export function formatDate(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }
  
  export function formatDateWithoutZ(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0];
  }
  