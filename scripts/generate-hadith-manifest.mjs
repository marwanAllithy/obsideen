import fs from "fs";
import path from "path";

const DATA_DIR = "data/hadith/by_book";
const CATEGORIES = ["the_9_books", "other_books", "forties"];

function main() {
	const books = [];
	for (const category of CATEGORIES) {
		const categoryPath = path.join(DATA_DIR, category);
		if (!fs.existsSync(categoryPath)) {
			console.warn(`Category directory missing: ${categoryPath}`);
			continue;
		}
		const files = fs
			.readdirSync(categoryPath)
			.filter((fileName) => fileName.endsWith(".json") && fileName !== "books.json");
		for (const fileName of files) {
			const filePath = path.join(categoryPath, fileName);
			const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
			books.push({
				id: data.metadata.id,
				fileName: fileName.replace(/\.json$/, ""),
				category,
				englishTitle: data.metadata.english.title,
				arabicTitle: data.metadata.arabic.title,
				englishAuthor: data.metadata.english.author,
				arabicAuthor: data.metadata.arabic.author,
				length: data.metadata.length
			});
		}
	}
	books.sort((a, b) => a.id - b.id);
	const manifestPath = path.join(DATA_DIR, "books.json");
	fs.writeFileSync(manifestPath, JSON.stringify(books, null, 2));
	console.log(`Wrote ${books.length} books to ${manifestPath}`);
}

main();
