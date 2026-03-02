import fs from 'fs';

let content = "# The Epic Journey of Tester (A 100-Chapter Test Book)\n\n";

for (let i = 1; i <= 100; i++) {
    content += `## Chapter ${i}\n\n`;
    content += `In this chapter, our protagonist Tester arrives at Location ${i}. `;
    content += `Here, Tester meets a friendly local named Alpha-${i}, who gifts them a mysterious artifact: the Orb of ${i}. `;
    content += `They spend the afternoon discussing the thematic significance of the number ${i}. `;
    content += `Suddenly, a menacing antagonist named Bug-${i} appears and attempts to steal the Orb of ${i}. `;
    content += `Tester, recalling the combat techniques learned recently, swiftly defeats Bug-${i}. `;
    content += `The chapter concludes with Tester looking toward the horizon, eagerly anticipating the events of Chapter ${i + 1}.\n\n`;

    // Add dummy paragraphs to give the chapter realistic length (simulating "pages")
    for (let p = 0; p < 15; p++) {
        content += `As the day gradually turned into evening at Location ${i}, the atmosphere grew increasingly pensive. The wind howled through the barren landscape, carrying whispers of ancient secrets. Tester sat by the campfire, reflecting on the encounter with Alpha-${i} and the surprising resilience of Bug-${i}. The Orb of ${i} pulsed rhythmically with a faint, ethereal glow, offering a small measure of comfort in the encroaching darkness. Every step of this journey seemed to test their limits, yet they pressed on. The stars emerged, forming unfamiliar constellations that offered little guidance. Yet, the resolve in Tester's heart remained unshaken. Tomorrow is another day, filled with unknown variables and potential bugs to squash.\n\n`;
    }
}

fs.writeFileSync('test_document.txt', content);
console.log("Successfully generated test_document.txt");
