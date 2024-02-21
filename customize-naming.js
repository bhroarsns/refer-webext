// You can customise the naming convention for article filename.
// The default function returns "PhysRevLett.VV.NNNNN.pdf" for Phys. Rev. Lett., volume VV, number NNNNN.
// Check existence before using any arguments by ternary operators.

function namingConvention(
    date, // Array of Number [YYYY, MM, DD]
    author, // e.g. [{given: "Albert", family: "Einstein"}, ...]
    title, // String
    journal, // String
    journalAbbr, // Journal title abbreviation as String
    volume, // String
    issue, // String
    pages, // String. "1-10" means pp.1-10.
    articleNumber // String
) {
    return (journalAbbr ? journalAbbr.replaceAll(".", "").replaceAll(" ", "") + "." : (journal ? journal.replaceAll(".", "").replaceAll(" ", "") + "." : ""))
        + (volume ? volume + "." : "")
        + (pages ? pages.split("-")[0] + "." : (articleNumber ? articleNumber.replace("/", ".") + "." : ""))
        + "pdf"
}

export { namingConvention }