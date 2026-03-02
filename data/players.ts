export interface CricketPlayer {
    id: string;
    name: string;
    role: 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKET_KEEPER';
    battingSkill: number;
    bowlingSkill: number;
    basePrice: number;
    nationality: string;
    image?: string;
}

export const IPL_PLAYERS: CricketPlayer[] = [
    // ========================================
    // ★ MARQUEE BATSMEN (skill 85+)
    // ========================================
    { id: 'p1', name: 'Virat Kohli', role: 'BATSMAN', battingSkill: 95, bowlingSkill: 15, basePrice: 2, nationality: 'Indian' },
    { id: 'p2', name: 'Rohit Sharma', role: 'BATSMAN', battingSkill: 93, bowlingSkill: 10, basePrice: 2, nationality: 'Indian' },
    { id: 'p3', name: 'Shubman Gill', role: 'BATSMAN', battingSkill: 88, bowlingSkill: 10, basePrice: 2, nationality: 'Indian' },
    { id: 'p4', name: 'KL Rahul', role: 'BATSMAN', battingSkill: 89, bowlingSkill: 5, basePrice: 2, nationality: 'Indian' },
    { id: 'p5', name: 'Suryakumar Yadav', role: 'BATSMAN', battingSkill: 91, bowlingSkill: 5, basePrice: 2, nationality: 'Indian' },
    { id: 'p6', name: 'Yashasvi Jaiswal', role: 'BATSMAN', battingSkill: 87, bowlingSkill: 10, basePrice: 2, nationality: 'Indian' },
    { id: 'p7', name: 'Ruturaj Gaikwad', role: 'BATSMAN', battingSkill: 85, bowlingSkill: 5, basePrice: 1.5, nationality: 'Indian' },
    { id: 'p8', name: 'Jos Buttler', role: 'BATSMAN', battingSkill: 92, bowlingSkill: 5, basePrice: 2, nationality: 'Overseas' },
    { id: 'p9', name: 'Travis Head', role: 'BATSMAN', battingSkill: 88, bowlingSkill: 15, basePrice: 2, nationality: 'Overseas' },
    { id: 'p10', name: 'Harry Brook', role: 'BATSMAN', battingSkill: 86, bowlingSkill: 10, basePrice: 2, nationality: 'Overseas' },
    { id: 'p11', name: 'Phil Salt', role: 'BATSMAN', battingSkill: 85, bowlingSkill: 5, basePrice: 2, nationality: 'Overseas' },
    { id: 'p12', name: 'Devon Conway', role: 'BATSMAN', battingSkill: 85, bowlingSkill: 5, basePrice: 1.5, nationality: 'Overseas' },

    // ========================================
    // BATSMEN (skill 75–84) — Indian
    // ========================================
    { id: 'p13', name: 'Sanju Samson', role: 'BATSMAN', battingSkill: 84, bowlingSkill: 5, basePrice: 1.5, nationality: 'Indian' },
    { id: 'p14', name: 'Shreyas Iyer', role: 'BATSMAN', battingSkill: 84, bowlingSkill: 10, basePrice: 1.5, nationality: 'Indian' },
    { id: 'p15', name: 'Ishan Kishan', role: 'BATSMAN', battingSkill: 82, bowlingSkill: 5, basePrice: 1.5, nationality: 'Indian' },
    { id: 'p16', name: 'Tilak Varma', role: 'BATSMAN', battingSkill: 83, bowlingSkill: 15, basePrice: 1.5, nationality: 'Indian' },
    { id: 'p17', name: 'Rinku Singh', role: 'BATSMAN', battingSkill: 83, bowlingSkill: 5, basePrice: 1, nationality: 'Indian' },
    { id: 'p18', name: 'Devdutt Padikkal', role: 'BATSMAN', battingSkill: 80, bowlingSkill: 5, basePrice: 1, nationality: 'Indian' },
    { id: 'p19', name: 'Prithvi Shaw', role: 'BATSMAN', battingSkill: 78, bowlingSkill: 5, basePrice: 0.75, nationality: 'Indian' },
    { id: 'p20', name: 'Rahul Tripathi', role: 'BATSMAN', battingSkill: 79, bowlingSkill: 5, basePrice: 1, nationality: 'Indian' },
    { id: 'p21', name: 'Abhishek Sharma', role: 'BATSMAN', battingSkill: 80, bowlingSkill: 25, basePrice: 1, nationality: 'Indian' },
    { id: 'p22', name: 'Rajat Patidar', role: 'BATSMAN', battingSkill: 78, bowlingSkill: 5, basePrice: 1, nationality: 'Indian' },
    { id: 'p23', name: 'Sai Sudharsan', role: 'BATSMAN', battingSkill: 76, bowlingSkill: 5, basePrice: 0.75, nationality: 'Indian' },

    // ========================================
    // BATSMEN (skill 75–84) — Overseas
    // ========================================
    { id: 'p24', name: 'Aiden Markram', role: 'BATSMAN', battingSkill: 81, bowlingSkill: 15, basePrice: 1, nationality: 'Overseas' },
    { id: 'p25', name: 'Jonny Bairstow', role: 'BATSMAN', battingSkill: 82, bowlingSkill: 5, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p26', name: 'Rachin Ravindra', role: 'BATSMAN', battingSkill: 80, bowlingSkill: 35, basePrice: 1, nationality: 'Overseas' },
    { id: 'p27', name: 'Daryl Mitchell', role: 'BATSMAN', battingSkill: 82, bowlingSkill: 20, basePrice: 1, nationality: 'Overseas' },
    { id: 'p28', name: 'Tim David', role: 'BATSMAN', battingSkill: 80, bowlingSkill: 5, basePrice: 1, nationality: 'Overseas' },
    { id: 'p29', name: 'Jake Fraser-McGurk', role: 'BATSMAN', battingSkill: 77, bowlingSkill: 10, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p30', name: 'Will Jacks', role: 'BATSMAN', battingSkill: 79, bowlingSkill: 30, basePrice: 1, nationality: 'Overseas' },
    { id: 'p31', name: 'Glenn Phillips', role: 'BATSMAN', battingSkill: 78, bowlingSkill: 25, basePrice: 1, nationality: 'Overseas' },
    { id: 'p32', name: 'Rovman Powell', role: 'BATSMAN', battingSkill: 77, bowlingSkill: 10, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p33', name: 'Shimron Hetmyer', role: 'BATSMAN', battingSkill: 80, bowlingSkill: 5, basePrice: 1, nationality: 'Overseas' },

    // ========================================
    // BATSMEN (skill 65–74) — Indian
    // ========================================
    { id: 'p34', name: 'Sarfaraz Khan', role: 'BATSMAN', battingSkill: 76, bowlingSkill: 5, basePrice: 0.75, nationality: 'Indian' },
    { id: 'p35', name: 'Riyan Parag', role: 'BATSMAN', battingSkill: 74, bowlingSkill: 20, basePrice: 0.75, nationality: 'Indian' },
    { id: 'p36', name: 'Dhruv Jurel', role: 'BATSMAN', battingSkill: 72, bowlingSkill: 5, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p37', name: 'Prabhsimran Singh', role: 'BATSMAN', battingSkill: 70, bowlingSkill: 5, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p38', name: 'Ayush Badoni', role: 'BATSMAN', battingSkill: 74, bowlingSkill: 15, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p39', name: 'Shahrukh Khan', role: 'BATSMAN', battingSkill: 72, bowlingSkill: 5, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p40', name: 'Abdul Samad', role: 'BATSMAN', battingSkill: 70, bowlingSkill: 10, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p41', name: 'Vivrant Sharma', role: 'BATSMAN', battingSkill: 69, bowlingSkill: 20, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p42', name: 'Mayank Agarwal', role: 'BATSMAN', battingSkill: 74, bowlingSkill: 5, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p43', name: 'Anuj Rawat', role: 'BATSMAN', battingSkill: 68, bowlingSkill: 5, basePrice: 0.5, nationality: 'Indian' },

    // ========================================
    // BATSMEN (skill 65–74) — Overseas
    // ========================================
    { id: 'p44', name: 'Dewald Brevis', role: 'BATSMAN', battingSkill: 74, bowlingSkill: 20, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p45', name: 'Tristan Stubbs', role: 'BATSMAN', battingSkill: 72, bowlingSkill: 15, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p46', name: 'Brandon King', role: 'BATSMAN', battingSkill: 74, bowlingSkill: 5, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p47', name: 'Shai Hope', role: 'BATSMAN', battingSkill: 76, bowlingSkill: 5, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p48', name: 'Sherfane Rutherford', role: 'BATSMAN', battingSkill: 73, bowlingSkill: 10, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p49', name: 'Alex Hales', role: 'BATSMAN', battingSkill: 78, bowlingSkill: 5, basePrice: 0.75, nationality: 'Overseas' },

    // ========================================
    // BATSMEN — Emerging/Uncapped
    // ========================================
    { id: 'p50', name: 'Yash Dhull', role: 'BATSMAN', battingSkill: 64, bowlingSkill: 10, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p51', name: 'Priyam Garg', role: 'BATSMAN', battingSkill: 62, bowlingSkill: 5, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p52', name: 'Sameer Rizvi', role: 'BATSMAN', battingSkill: 62, bowlingSkill: 20, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p53', name: 'Nehal Wadhera', role: 'BATSMAN', battingSkill: 64, bowlingSkill: 10, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p54', name: 'Angkrish Raghuvanshi', role: 'BATSMAN', battingSkill: 60, bowlingSkill: 5, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p55', name: 'Swastik Chikara', role: 'BATSMAN', battingSkill: 58, bowlingSkill: 5, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p56', name: 'Kumar Kushagra', role: 'BATSMAN', battingSkill: 58, bowlingSkill: 5, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p57', name: 'Aman Hakim Khan', role: 'BATSMAN', battingSkill: 56, bowlingSkill: 5, basePrice: 0.2, nationality: 'Indian' },

    // ========================================
    // ★ MARQUEE ALL-ROUNDERS
    // ========================================
    { id: 'p58', name: 'Hardik Pandya', role: 'ALL_ROUNDER', battingSkill: 85, bowlingSkill: 75, basePrice: 2, nationality: 'Indian' },
    { id: 'p59', name: 'Ravindra Jadeja', role: 'ALL_ROUNDER', battingSkill: 78, bowlingSkill: 85, basePrice: 2, nationality: 'Indian' },
    { id: 'p60', name: 'Ravichandran Ashwin', role: 'ALL_ROUNDER', battingSkill: 60, bowlingSkill: 90, basePrice: 2, nationality: 'Indian' },
    { id: 'p61', name: 'Andre Russell', role: 'ALL_ROUNDER', battingSkill: 90, bowlingSkill: 72, basePrice: 2, nationality: 'Overseas' },
    { id: 'p62', name: 'Glenn Maxwell', role: 'ALL_ROUNDER', battingSkill: 88, bowlingSkill: 65, basePrice: 2, nationality: 'Overseas' },
    { id: 'p63', name: 'Sunil Narine', role: 'ALL_ROUNDER', battingSkill: 78, bowlingSkill: 88, basePrice: 2, nationality: 'Overseas' },
    { id: 'p64', name: 'Mitchell Marsh', role: 'ALL_ROUNDER', battingSkill: 82, bowlingSkill: 68, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p65', name: 'Ben Stokes', role: 'ALL_ROUNDER', battingSkill: 85, bowlingSkill: 78, basePrice: 2, nationality: 'Overseas' },

    // ========================================
    // ALL-ROUNDERS — Indian (Capped)
    // ========================================
    { id: 'p66', name: 'Axar Patel', role: 'ALL_ROUNDER', battingSkill: 72, bowlingSkill: 80, basePrice: 1.5, nationality: 'Indian' },
    { id: 'p67', name: 'Washington Sundar', role: 'ALL_ROUNDER', battingSkill: 68, bowlingSkill: 75, basePrice: 1, nationality: 'Indian' },
    { id: 'p68', name: 'Venkatesh Iyer', role: 'ALL_ROUNDER', battingSkill: 75, bowlingSkill: 65, basePrice: 1, nationality: 'Indian' },
    { id: 'p69', name: 'Shardul Thakur', role: 'ALL_ROUNDER', battingSkill: 65, bowlingSkill: 75, basePrice: 1, nationality: 'Indian' },
    { id: 'p70', name: 'Krunal Pandya', role: 'ALL_ROUNDER', battingSkill: 68, bowlingSkill: 72, basePrice: 1, nationality: 'Indian' },
    { id: 'p71', name: 'Deepak Hooda', role: 'ALL_ROUNDER', battingSkill: 74, bowlingSkill: 55, basePrice: 0.75, nationality: 'Indian' },
    { id: 'p72', name: 'Nitish Rana', role: 'ALL_ROUNDER', battingSkill: 74, bowlingSkill: 45, basePrice: 0.75, nationality: 'Indian' },
    { id: 'p73', name: 'Shivam Dube', role: 'ALL_ROUNDER', battingSkill: 74, bowlingSkill: 52, basePrice: 0.75, nationality: 'Indian' },
    { id: 'p74', name: 'Shahbaz Ahmed', role: 'ALL_ROUNDER', battingSkill: 65, bowlingSkill: 68, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p75', name: 'Nitish Kumar Reddy', role: 'ALL_ROUNDER', battingSkill: 70, bowlingSkill: 64, basePrice: 0.75, nationality: 'Indian' },
    { id: 'p76', name: 'Vijay Shankar', role: 'ALL_ROUNDER', battingSkill: 68, bowlingSkill: 60, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p77', name: 'Harpreet Brar', role: 'ALL_ROUNDER', battingSkill: 55, bowlingSkill: 68, basePrice: 0.5, nationality: 'Indian' },

    // ========================================
    // ALL-ROUNDERS — Overseas
    // ========================================
    { id: 'p78', name: 'Sam Curran', role: 'ALL_ROUNDER', battingSkill: 75, bowlingSkill: 78, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p79', name: 'Cameron Green', role: 'ALL_ROUNDER', battingSkill: 82, bowlingSkill: 72, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p80', name: 'Marcus Stoinis', role: 'ALL_ROUNDER', battingSkill: 80, bowlingSkill: 65, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p81', name: 'Liam Livingstone', role: 'ALL_ROUNDER', battingSkill: 84, bowlingSkill: 55, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p82', name: 'Moeen Ali', role: 'ALL_ROUNDER', battingSkill: 78, bowlingSkill: 68, basePrice: 1, nationality: 'Overseas' },
    { id: 'p83', name: 'Wanindu Hasaranga', role: 'ALL_ROUNDER', battingSkill: 55, bowlingSkill: 85, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p84', name: 'Jason Holder', role: 'ALL_ROUNDER', battingSkill: 65, bowlingSkill: 78, basePrice: 1, nationality: 'Overseas' },
    { id: 'p85', name: 'Sikandar Raza', role: 'ALL_ROUNDER', battingSkill: 72, bowlingSkill: 65, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p86', name: 'Mitchell Santner', role: 'ALL_ROUNDER', battingSkill: 55, bowlingSkill: 72, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p87', name: 'Kyle Mayers', role: 'ALL_ROUNDER', battingSkill: 72, bowlingSkill: 60, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p88', name: 'Romario Shepherd', role: 'ALL_ROUNDER', battingSkill: 62, bowlingSkill: 68, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p89', name: 'Odean Smith', role: 'ALL_ROUNDER', battingSkill: 55, bowlingSkill: 65, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p90', name: 'Mohammad Nabi', role: 'ALL_ROUNDER', battingSkill: 68, bowlingSkill: 72, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p91', name: 'Tom Curran', role: 'ALL_ROUNDER', battingSkill: 50, bowlingSkill: 70, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p92', name: 'Matthew Short', role: 'ALL_ROUNDER', battingSkill: 72, bowlingSkill: 50, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p93', name: 'Akeal Hosein', role: 'ALL_ROUNDER', battingSkill: 45, bowlingSkill: 72, basePrice: 0.5, nationality: 'Overseas' },

    // ========================================
    // ALL-ROUNDERS — Emerging/Uncapped Indian
    // ========================================
    { id: 'p94', name: 'Lalit Yadav', role: 'ALL_ROUNDER', battingSkill: 60, bowlingSkill: 55, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p95', name: 'Mahipal Lomror', role: 'ALL_ROUNDER', battingSkill: 62, bowlingSkill: 50, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p96', name: 'Ramandeep Singh', role: 'ALL_ROUNDER', battingSkill: 58, bowlingSkill: 48, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p97', name: 'Noor Ahmad', role: 'ALL_ROUNDER', battingSkill: 30, bowlingSkill: 72, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p98', name: 'Darshan Nalkande', role: 'ALL_ROUNDER', battingSkill: 50, bowlingSkill: 58, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p99', name: 'Anukul Roy', role: 'ALL_ROUNDER', battingSkill: 52, bowlingSkill: 60, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p100', name: 'Nishant Sindhu', role: 'ALL_ROUNDER', battingSkill: 55, bowlingSkill: 50, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p101', name: 'Himanshu Sharma', role: 'ALL_ROUNDER', battingSkill: 50, bowlingSkill: 52, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p102', name: 'Tanush Kotian', role: 'ALL_ROUNDER', battingSkill: 50, bowlingSkill: 58, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p103', name: 'Arshin Kulkarni', role: 'ALL_ROUNDER', battingSkill: 55, bowlingSkill: 50, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p104', name: 'Naman Dhir', role: 'ALL_ROUNDER', battingSkill: 54, bowlingSkill: 48, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p105', name: 'Prerak Mankad', role: 'ALL_ROUNDER', battingSkill: 52, bowlingSkill: 50, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p106', name: 'Donovan Ferreira', role: 'ALL_ROUNDER', battingSkill: 58, bowlingSkill: 52, basePrice: 0.3, nationality: 'Overseas' },

    // ========================================
    // ★ MARQUEE PACE BOWLERS (skill 85+)
    // ========================================
    { id: 'p107', name: 'Jasprit Bumrah', role: 'BOWLER', battingSkill: 15, bowlingSkill: 96, basePrice: 2, nationality: 'Indian' },
    { id: 'p108', name: 'Mohammed Shami', role: 'BOWLER', battingSkill: 15, bowlingSkill: 88, basePrice: 2, nationality: 'Indian' },
    { id: 'p109', name: 'Mohammed Siraj', role: 'BOWLER', battingSkill: 10, bowlingSkill: 85, basePrice: 1.5, nationality: 'Indian' },
    { id: 'p110', name: 'Kagiso Rabada', role: 'BOWLER', battingSkill: 20, bowlingSkill: 90, basePrice: 2, nationality: 'Overseas' },
    { id: 'p111', name: 'Pat Cummins', role: 'BOWLER', battingSkill: 45, bowlingSkill: 89, basePrice: 2, nationality: 'Overseas' },
    { id: 'p112', name: 'Mitchell Starc', role: 'BOWLER', battingSkill: 25, bowlingSkill: 90, basePrice: 2, nationality: 'Overseas' },
    { id: 'p113', name: 'Trent Boult', role: 'BOWLER', battingSkill: 15, bowlingSkill: 88, basePrice: 2, nationality: 'Overseas' },
    { id: 'p114', name: 'Jofra Archer', role: 'BOWLER', battingSkill: 20, bowlingSkill: 87, basePrice: 2, nationality: 'Overseas' },

    // ========================================
    // ★ MARQUEE SPIN BOWLERS (skill 85+)
    // ========================================
    { id: 'p115', name: 'Rashid Khan', role: 'BOWLER', battingSkill: 55, bowlingSkill: 92, basePrice: 2, nationality: 'Overseas' },
    { id: 'p116', name: 'Yuzvendra Chahal', role: 'BOWLER', battingSkill: 10, bowlingSkill: 87, basePrice: 1.5, nationality: 'Indian' },
    { id: 'p117', name: 'Kuldeep Yadav', role: 'BOWLER', battingSkill: 15, bowlingSkill: 86, basePrice: 1.5, nationality: 'Indian' },
    { id: 'p118', name: 'Adam Zampa', role: 'BOWLER', battingSkill: 15, bowlingSkill: 85, basePrice: 1.5, nationality: 'Overseas' },

    // ========================================
    // PACE BOWLERS (skill 75–84) — Indian
    // ========================================
    { id: 'p119', name: 'Arshdeep Singh', role: 'BOWLER', battingSkill: 10, bowlingSkill: 82, basePrice: 1, nationality: 'Indian' },
    { id: 'p120', name: 'Umran Malik', role: 'BOWLER', battingSkill: 5, bowlingSkill: 80, basePrice: 1, nationality: 'Indian' },
    { id: 'p121', name: 'Prasidh Krishna', role: 'BOWLER', battingSkill: 10, bowlingSkill: 79, basePrice: 1, nationality: 'Indian' },
    { id: 'p122', name: 'Deepak Chahar', role: 'BOWLER', battingSkill: 40, bowlingSkill: 80, basePrice: 1, nationality: 'Indian' },
    { id: 'p123', name: 'Bhuvneshwar Kumar', role: 'BOWLER', battingSkill: 30, bowlingSkill: 82, basePrice: 1, nationality: 'Indian' },
    { id: 'p124', name: 'T Natarajan', role: 'BOWLER', battingSkill: 10, bowlingSkill: 77, basePrice: 0.75, nationality: 'Indian' },
    { id: 'p125', name: 'Avesh Khan', role: 'BOWLER', battingSkill: 10, bowlingSkill: 76, basePrice: 0.75, nationality: 'Indian' },
    { id: 'p126', name: 'Harshit Rana', role: 'BOWLER', battingSkill: 15, bowlingSkill: 75, basePrice: 0.75, nationality: 'Indian' },

    // ========================================
    // PACE BOWLERS (skill 75–84) — Overseas
    // ========================================
    { id: 'p127', name: 'Josh Hazlewood', role: 'BOWLER', battingSkill: 15, bowlingSkill: 87, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p128', name: 'Anrich Nortje', role: 'BOWLER', battingSkill: 10, bowlingSkill: 86, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p129', name: 'Lockie Ferguson', role: 'BOWLER', battingSkill: 10, bowlingSkill: 83, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p130', name: 'Mark Wood', role: 'BOWLER', battingSkill: 10, bowlingSkill: 82, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p131', name: 'Marco Jansen', role: 'BOWLER', battingSkill: 30, bowlingSkill: 80, basePrice: 1, nationality: 'Overseas' },
    { id: 'p132', name: 'Gerald Coetzee', role: 'BOWLER', battingSkill: 15, bowlingSkill: 79, basePrice: 1, nationality: 'Overseas' },
    { id: 'p133', name: 'Mustafizur Rahman', role: 'BOWLER', battingSkill: 10, bowlingSkill: 78, basePrice: 1, nationality: 'Overseas' },
    { id: 'p134', name: 'Lungi Ngidi', role: 'BOWLER', battingSkill: 10, bowlingSkill: 80, basePrice: 1, nationality: 'Overseas' },
    { id: 'p135', name: 'Matheesha Pathirana', role: 'BOWLER', battingSkill: 5, bowlingSkill: 78, basePrice: 1, nationality: 'Overseas' },
    { id: 'p136', name: 'Spencer Johnson', role: 'BOWLER', battingSkill: 10, bowlingSkill: 76, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p137', name: 'Shaheen Afridi', role: 'BOWLER', battingSkill: 15, bowlingSkill: 88, basePrice: 2, nationality: 'Overseas' },

    // ========================================
    // SPIN BOWLERS (skill 70–84)
    // ========================================
    { id: 'p138', name: 'Ravi Bishnoi', role: 'BOWLER', battingSkill: 10, bowlingSkill: 78, basePrice: 1, nationality: 'Indian' },
    { id: 'p139', name: 'Varun Chakravarthy', role: 'BOWLER', battingSkill: 10, bowlingSkill: 80, basePrice: 1, nationality: 'Indian' },
    { id: 'p140', name: 'Rahul Chahar', role: 'BOWLER', battingSkill: 10, bowlingSkill: 75, basePrice: 0.75, nationality: 'Indian' },
    { id: 'p141', name: 'Maheesh Theekshana', role: 'BOWLER', battingSkill: 10, bowlingSkill: 78, basePrice: 1, nationality: 'Overseas' },
    { id: 'p142', name: 'Akash Deep', role: 'BOWLER', battingSkill: 10, bowlingSkill: 74, basePrice: 0.5, nationality: 'Indian' },

    // ========================================
    // BOWLERS — Mid-tier (skill 65–74)
    // ========================================
    { id: 'p143', name: 'Mukesh Kumar', role: 'BOWLER', battingSkill: 10, bowlingSkill: 74, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p144', name: 'Tushar Deshpande', role: 'BOWLER', battingSkill: 5, bowlingSkill: 72, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p145', name: 'Mohsin Khan', role: 'BOWLER', battingSkill: 5, bowlingSkill: 72, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p146', name: 'Yash Dayal', role: 'BOWLER', battingSkill: 10, bowlingSkill: 72, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p147', name: 'Khaleel Ahmed', role: 'BOWLER', battingSkill: 5, bowlingSkill: 70, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p148', name: 'Sandeep Sharma', role: 'BOWLER', battingSkill: 5, bowlingSkill: 68, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p149', name: 'Chetan Sakariya', role: 'BOWLER', battingSkill: 10, bowlingSkill: 68, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p150', name: 'Kartik Tyagi', role: 'BOWLER', battingSkill: 5, bowlingSkill: 68, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p151', name: 'Navdeep Saini', role: 'BOWLER', battingSkill: 10, bowlingSkill: 72, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p152', name: 'R Sai Kishore', role: 'BOWLER', battingSkill: 15, bowlingSkill: 68, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p153', name: 'Akash Madhwal', role: 'BOWLER', battingSkill: 5, bowlingSkill: 70, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p154', name: 'Tim Southee', role: 'BOWLER', battingSkill: 30, bowlingSkill: 80, basePrice: 1, nationality: 'Overseas' },
    { id: 'p155', name: 'Fazalhaq Farooqi', role: 'BOWLER', battingSkill: 5, bowlingSkill: 76, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p156', name: 'Alzarri Joseph', role: 'BOWLER', battingSkill: 20, bowlingSkill: 75, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p157', name: 'Reece Topley', role: 'BOWLER', battingSkill: 5, bowlingSkill: 72, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p158', name: 'Kyle Jamieson', role: 'BOWLER', battingSkill: 30, bowlingSkill: 74, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p159', name: 'Nathan Ellis', role: 'BOWLER', battingSkill: 10, bowlingSkill: 72, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p160', name: 'Nuwan Thushara', role: 'BOWLER', battingSkill: 5, bowlingSkill: 72, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p161', name: 'Marchant de Lange', role: 'BOWLER', battingSkill: 10, bowlingSkill: 74, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p162', name: 'Obed McCoy', role: 'BOWLER', battingSkill: 10, bowlingSkill: 72, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p163', name: 'Dushmantha Chameera', role: 'BOWLER', battingSkill: 10, bowlingSkill: 74, basePrice: 0.5, nationality: 'Overseas' },

    // ========================================
    // BOWLERS — Emerging/Uncapped
    // ========================================
    { id: 'p164', name: 'Vyshak Vijaykumar', role: 'BOWLER', battingSkill: 5, bowlingSkill: 64, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p165', name: 'Akash Singh', role: 'BOWLER', battingSkill: 5, bowlingSkill: 62, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p166', name: 'Rasikh Salam', role: 'BOWLER', battingSkill: 5, bowlingSkill: 60, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p167', name: 'Saurabh Kumar', role: 'BOWLER', battingSkill: 15, bowlingSkill: 64, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p168', name: 'Vaibhav Arora', role: 'BOWLER', battingSkill: 5, bowlingSkill: 62, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p169', name: 'Mayank Markande', role: 'BOWLER', battingSkill: 10, bowlingSkill: 65, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p170', name: 'Siddarth Kaul', role: 'BOWLER', battingSkill: 5, bowlingSkill: 68, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p171', name: 'Shreyas Gopal', role: 'BOWLER', battingSkill: 35, bowlingSkill: 68, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p172', name: 'Mayank Dagar', role: 'BOWLER', battingSkill: 15, bowlingSkill: 64, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p173', name: 'Murugan Ashwin', role: 'BOWLER', battingSkill: 10, bowlingSkill: 64, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p174', name: 'Basil Thampi', role: 'BOWLER', battingSkill: 5, bowlingSkill: 65, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p175', name: 'Nandre Burger', role: 'BOWLER', battingSkill: 5, bowlingSkill: 62, basePrice: 0.3, nationality: 'Overseas' },
    { id: 'p176', name: 'Sisanda Magala', role: 'BOWLER', battingSkill: 10, bowlingSkill: 62, basePrice: 0.3, nationality: 'Overseas' },
    { id: 'p177', name: 'Kwena Maphaka', role: 'BOWLER', battingSkill: 5, bowlingSkill: 68, basePrice: 0.3, nationality: 'Overseas' },
    { id: 'p178', name: 'Riley Meredith', role: 'BOWLER', battingSkill: 5, bowlingSkill: 68, basePrice: 0.5, nationality: 'Overseas' },

    // ========================================
    // ★ WICKET-KEEPERS — Top Tier
    // ========================================
    { id: 'p179', name: 'Rishabh Pant', role: 'WICKET_KEEPER', battingSkill: 88, bowlingSkill: 5, basePrice: 2, nationality: 'Indian' },
    { id: 'p180', name: 'Heinrich Klaasen', role: 'WICKET_KEEPER', battingSkill: 85, bowlingSkill: 5, basePrice: 2, nationality: 'Overseas' },
    { id: 'p181', name: 'Nicholas Pooran', role: 'WICKET_KEEPER', battingSkill: 82, bowlingSkill: 5, basePrice: 1.5, nationality: 'Overseas' },

    // ========================================
    // WICKET-KEEPERS — Mid Tier
    // ========================================
    { id: 'p182', name: 'KS Bharat', role: 'WICKET_KEEPER', battingSkill: 65, bowlingSkill: 5, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p183', name: 'Josh Inglis', role: 'WICKET_KEEPER', battingSkill: 76, bowlingSkill: 5, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p184', name: 'Rahmanullah Gurbaz', role: 'WICKET_KEEPER', battingSkill: 80, bowlingSkill: 5, basePrice: 1, nationality: 'Overseas' },
    { id: 'p185', name: 'Tom Latham', role: 'WICKET_KEEPER', battingSkill: 75, bowlingSkill: 5, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p186', name: 'Alex Carey', role: 'WICKET_KEEPER', battingSkill: 72, bowlingSkill: 5, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p187', name: 'Matthew Wade', role: 'WICKET_KEEPER', battingSkill: 74, bowlingSkill: 5, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p188', name: 'Lorcan Tucker', role: 'WICKET_KEEPER', battingSkill: 64, bowlingSkill: 5, basePrice: 0.3, nationality: 'Overseas' },
    { id: 'p189', name: 'Jitesh Sharma', role: 'WICKET_KEEPER', battingSkill: 72, bowlingSkill: 5, basePrice: 0.5, nationality: 'Indian' },

    // ========================================
    // ADDITIONAL ACTIVE PLAYERS — Fill to 250
    // ========================================
    { id: 'p190', name: 'David Warner', role: 'BATSMAN', battingSkill: 88, bowlingSkill: 10, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p191', name: 'Quinton de Kock', role: 'BATSMAN', battingSkill: 86, bowlingSkill: 5, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p192', name: 'Faf du Plessis', role: 'BATSMAN', battingSkill: 84, bowlingSkill: 10, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p193', name: 'Kane Williamson', role: 'BATSMAN', battingSkill: 86, bowlingSkill: 10, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p194', name: 'Dawid Malan', role: 'BATSMAN', battingSkill: 79, bowlingSkill: 10, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p195', name: 'Chris Lynn', role: 'BATSMAN', battingSkill: 78, bowlingSkill: 5, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p196', name: 'Karun Nair', role: 'BATSMAN', battingSkill: 72, bowlingSkill: 5, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p197', name: 'Hanuma Vihari', role: 'BATSMAN', battingSkill: 72, bowlingSkill: 15, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p198', name: 'Rishi Dhawan', role: 'ALL_ROUNDER', battingSkill: 60, bowlingSkill: 62, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p199', name: 'Arjun Tendulkar', role: 'ALL_ROUNDER', battingSkill: 48, bowlingSkill: 60, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p200', name: 'Fabian Allen', role: 'ALL_ROUNDER', battingSkill: 52, bowlingSkill: 62, basePrice: 0.3, nationality: 'Overseas' },
    { id: 'p201', name: 'Harry Tector', role: 'BATSMAN', battingSkill: 67, bowlingSkill: 10, basePrice: 0.3, nationality: 'Overseas' },
    { id: 'p202', name: 'Dwaine Pretorius', role: 'ALL_ROUNDER', battingSkill: 62, bowlingSkill: 72, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p203', name: 'Daniel Sams', role: 'BOWLER', battingSkill: 35, bowlingSkill: 72, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p204', name: 'Sanvir Singh', role: 'ALL_ROUNDER', battingSkill: 52, bowlingSkill: 48, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p205', name: 'David Willey', role: 'ALL_ROUNDER', battingSkill: 65, bowlingSkill: 72, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p206', name: 'Steve Smith', role: 'BATSMAN', battingSkill: 84, bowlingSkill: 20, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p207', name: 'Shakib Al Hasan', role: 'ALL_ROUNDER', battingSkill: 78, bowlingSkill: 80, basePrice: 1.5, nationality: 'Overseas' },
    { id: 'p208', name: 'Babar Azam', role: 'BATSMAN', battingSkill: 91, bowlingSkill: 5, basePrice: 2, nationality: 'Overseas' },
    { id: 'p209', name: 'Chris Jordan', role: 'BOWLER', battingSkill: 25, bowlingSkill: 74, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p210', name: 'Jason Behrendorff', role: 'BOWLER', battingSkill: 5, bowlingSkill: 72, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p211', name: 'Karn Sharma', role: 'BOWLER', battingSkill: 15, bowlingSkill: 62, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p212', name: 'Jaydev Unadkat', role: 'BOWLER', battingSkill: 15, bowlingSkill: 72, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p213', name: 'Umesh Yadav', role: 'BOWLER', battingSkill: 15, bowlingSkill: 74, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p214', name: 'Wriddhiman Saha', role: 'WICKET_KEEPER', battingSkill: 68, bowlingSkill: 5, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p215', name: 'Mandeep Singh', role: 'BATSMAN', battingSkill: 70, bowlingSkill: 5, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p216', name: 'Bhanuka Rajapaksa', role: 'BATSMAN', battingSkill: 76, bowlingSkill: 5, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p217', name: 'Pathum Nissanka', role: 'BATSMAN', battingSkill: 78, bowlingSkill: 10, basePrice: 1, nationality: 'Overseas' },
    { id: 'p218', name: 'Charith Asalanka', role: 'BATSMAN', battingSkill: 76, bowlingSkill: 20, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p219', name: 'Kusal Mendis', role: 'WICKET_KEEPER', battingSkill: 78, bowlingSkill: 5, basePrice: 1, nationality: 'Overseas' },
    { id: 'p220', name: 'Ibrahim Zadran', role: 'BATSMAN', battingSkill: 76, bowlingSkill: 5, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p221', name: 'Azmatullah Omarzai', role: 'ALL_ROUNDER', battingSkill: 68, bowlingSkill: 70, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p222', name: 'Gulbadin Naib', role: 'ALL_ROUNDER', battingSkill: 60, bowlingSkill: 65, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p223', name: 'Naveen-ul-Haq', role: 'BOWLER', battingSkill: 15, bowlingSkill: 76, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p224', name: 'Dasun Shanaka', role: 'ALL_ROUNDER', battingSkill: 68, bowlingSkill: 62, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p225', name: 'Gudakesh Motie', role: 'BOWLER', battingSkill: 15, bowlingSkill: 72, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p226', name: 'Ottneil Baartman', role: 'BOWLER', battingSkill: 5, bowlingSkill: 70, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p227', name: 'Mayank Yadav', role: 'BOWLER', battingSkill: 5, bowlingSkill: 76, basePrice: 0.75, nationality: 'Indian' },
    { id: 'p228', name: 'Yash Thakur', role: 'BOWLER', battingSkill: 10, bowlingSkill: 65, basePrice: 0.3, nationality: 'Indian' },
    { id: 'p229', name: 'Vidwath Kaverappa', role: 'BOWLER', battingSkill: 5, bowlingSkill: 62, basePrice: 0.2, nationality: 'Indian' },
    { id: 'p230', name: 'Mohit Sharma', role: 'BOWLER', battingSkill: 10, bowlingSkill: 72, basePrice: 0.5, nationality: 'Indian' },
    { id: 'p231', name: 'Dilshan Madushanka', role: 'BOWLER', battingSkill: 5, bowlingSkill: 70, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p232', name: 'Litton Das', role: 'WICKET_KEEPER', battingSkill: 74, bowlingSkill: 5, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p233', name: 'Mushfiqur Rahim', role: 'WICKET_KEEPER', battingSkill: 74, bowlingSkill: 5, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p234', name: 'Devon Thomas', role: 'WICKET_KEEPER', battingSkill: 62, bowlingSkill: 5, basePrice: 0.3, nationality: 'Overseas' },
    { id: 'p235', name: 'Mujeeb Ur Rahman', role: 'BOWLER', battingSkill: 10, bowlingSkill: 74, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p236', name: 'Tabraiz Shamsi', role: 'BOWLER', battingSkill: 5, bowlingSkill: 76, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p237', name: 'George Linde', role: 'ALL_ROUNDER', battingSkill: 55, bowlingSkill: 65, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p238', name: 'Rassie van der Dussen', role: 'BATSMAN', battingSkill: 80, bowlingSkill: 5, basePrice: 1, nationality: 'Overseas' },
    { id: 'p239', name: 'Reeza Hendricks', role: 'BATSMAN', battingSkill: 76, bowlingSkill: 5, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p240', name: 'Shorful Islam', role: 'BOWLER', battingSkill: 10, bowlingSkill: 68, basePrice: 0.3, nationality: 'Overseas' },
    { id: 'p241', name: 'Rishad Hossain', role: 'BOWLER', battingSkill: 15, bowlingSkill: 66, basePrice: 0.3, nationality: 'Overseas' },
    { id: 'p242', name: 'Tanzim Hasan Sakib', role: 'BOWLER', battingSkill: 10, bowlingSkill: 68, basePrice: 0.3, nationality: 'Overseas' },
    { id: 'p243', name: 'Towhid Hridoy', role: 'BATSMAN', battingSkill: 72, bowlingSkill: 10, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p244', name: 'Taskin Ahmed', role: 'BOWLER', battingSkill: 10, bowlingSkill: 74, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p245', name: 'Mark Adair', role: 'ALL_ROUNDER', battingSkill: 55, bowlingSkill: 68, basePrice: 0.3, nationality: 'Overseas' },
    { id: 'p246', name: 'Curtis Campher', role: 'ALL_ROUNDER', battingSkill: 62, bowlingSkill: 65, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p247', name: 'Wayanad Mulder', role: 'ALL_ROUNDER', battingSkill: 58, bowlingSkill: 68, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p248', name: 'Aamer Jamal', role: 'ALL_ROUNDER', battingSkill: 55, bowlingSkill: 70, basePrice: 0.5, nationality: 'Overseas' },
    { id: 'p249', name: 'Hasan Ali', role: 'BOWLER', battingSkill: 20, bowlingSkill: 76, basePrice: 0.75, nationality: 'Overseas' },
    { id: 'p250', name: 'Shadab Khan', role: 'ALL_ROUNDER', battingSkill: 65, bowlingSkill: 75, basePrice: 1, nationality: 'Overseas' },
];

// Legacy export for backward compatibility
export const TEAM_NAMES = [
    'Chennai Super Kings',
    'Mumbai Indians',
    'Royal Challengers Bangalore',
    'Kolkata Knight Riders',
    'Delhi Capitals',
    'Sunrisers Hyderabad',
    'Punjab Kings',
    'Rajasthan Royals',
    'Lucknow Super Giants',
    'Gujarat Titans',
];
