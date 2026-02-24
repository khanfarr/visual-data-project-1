
## Global Student Mobility: Inbound vs Outbound
This data visualization project will highlight how students move across borders for education.
Live Website: https://visual-data-project-1.khansfareena.workers.dev/

 **Analyze how education opportunities and international flows differ across countries by focusing on the following**
- Patterns and differences by region
- How common high/low values are globally 
- The relationship between sending and receiving 

- Access to higher education
- Opportunity and inequality
- Globalization and “where talent goes”
- Whether a country is an education destination (attracts students) or a sender (students leave)

Data sources:
- [Share of students from abroad](https://ourworldindata.org/grapher/share-of-students-from-abroad?mapSelect=USA~ETH~LBY)
- [Share of students studying abroad](https://ourworldindata.org/grapher/share-of-students-studying-abroad?mapSelect=ARE~NER~DZA)


### other notes
share-of-students-from-abroad.csv = inbound
share-of-students-studying-abroad.csv = outbound

### some interesting analysis to shrare
The map legend updates based on the data currently shown.
For example, in Inbound mode, the legend ends at 85.57% because that is the highest inbound value in the selected year.
So the color bar is not a fixed 0–100 scale; it automatically adjusts to the real minimum and maximum values in the current view.

![Map view](media/dashboard-screenshot.png)