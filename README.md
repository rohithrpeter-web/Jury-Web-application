# ------------------------------ Jury Web App -------------------------

This web application is build for judges to grade contestants based on 7 Categories. Each judge will have their own "My Leaderboard" where they will be able to view the grades they have given to the contestants. There will also be an Admin account where the Admin will be able to view all the grades given by the judges for each contestants with the "Total grade Leaderboard".


# (i) Judge side Features
1) The Web application has three separate leaderboards for the age categories: Junior, Youth, Adult.
2) The app indicates the specific colors given for the age category.

3) There would be a timer for the judge which starts when the judge has submitted the scores for a contestants. A 1 min timer if they change their mind in the scores they made. Once the timer is up, the scores would be locked.

4) The scores will be in increments of 0.5 from the scale of (0 - 10). A score of 0 is not permitted, and the judge would be informed which category hasn't been marked. Once all categories are filled, the grades would be send.

5) Judge will be able to search name of contestant in the left side panel.
6) Total No. of contestants will be shown in the bottom left panel, where it shows the No. of contestants that have been graded (Shown as a progress bar).
7) Login and Logout feature has been implemented for these judges. (Haven't made a create account feature for this yet. This is handled by an admin)


# (ii) Admin side Features
1) Able to view the No. of contestants, judges, categories, age categories (Including the color given for them).
2) Have access in viewing 3 different leaderboards (Each one for the age categories), where they will be able to see what each judge has graded for each contestant. This includes specifics like the exact grade given to the exact category.
3) Able to see if a judge has graded or not.
4) Refreshes the page each 10-15 seconds for the updated results.
5) Have access to the "Advanced Features" where they will be able to view/create a judge/contestant.
6) An admin will also be able to view the password information of the judge incase they forget. (Not a proper solution, but in later updates it will be fixed)
