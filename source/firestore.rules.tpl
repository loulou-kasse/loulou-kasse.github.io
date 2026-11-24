rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Доступ только у владельцев: вход через Google, адрес подтверждён и есть в списке.
    function owner() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email.lower() in [/*EMAILS*/];
    }
    // Записи журнала и счета не удаляются: ошибки исправляются отменой (Storno).
    match /entries/{id} { allow read, create, update: if owner(); }
    match /invoices/{no} { allow read, create, update: if owner(); }
    match /templates/{id} { allow read, write: if owner(); }
    match /meta/{id} { allow read, write: if owner(); }
  }
}
