function booksSnippet(books) {
  return books.map(b => `${b.bookId} | ${b.title} | ${b.author} | copies:${b.copies_available} | ${b.location}`).join('\n');
}

function buildPromptForSearch(userMessage, booksSnippetText) {
  return `User: ${userMessage}\n\nAvailable books:\n${booksSnippetText}\n\nAnswer concisely. If the user asks to reserve a specific book AND that book is available, OUTPUT EXACTLY one single-line JSON object (no extra text) in this format:\n{"action":"reserve_book","bookId":"<ID>","title":"<Title>"}\nOtherwise reply with a natural-language answer.`;
}

module.exports = { booksSnippet, buildPromptForSearch };
